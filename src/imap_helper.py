#!/usr/bin/env python3
"""Read-only METU IMAP helper using Python stdlib (compatible with Perdition proxy).
Reads JSON request (including credentials) from stdin so secrets never appear in argv.
"""

import email
import imaplib
import json
import os
import re
import sys
from email.header import decode_header
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser


def decode_mime_str(value):
    if not value:
        return ""
    parts = []
    for chunk, charset in decode_header(value):
        if isinstance(chunk, bytes):
            enc = charset or "utf-8"
            try:
                parts.append(chunk.decode(enc, errors="replace"))
            except LookupError:
                parts.append(chunk.decode("utf-8", errors="replace"))
        else:
            parts.append(chunk)
    return "".join(parts).strip()


def decode_payload(part):
    payload = part.get_payload(decode=True)
    if payload is None:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


class _HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._skip = False
        self.chunks = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        t = tag.lower()
        if t in ("script", "style"):
            self._skip = True
        elif t in ("br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4"):
            self.chunks.append("\n")
        if t == "a":
            for k, v in attrs:
                if k.lower() == "href" and v and re.match(r"^https?://", v, re.I):
                    self.links.append(v)

    def handle_endtag(self, tag):
        if tag.lower() in ("script", "style"):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self.chunks.append(data)


def html_to_text_and_links(html_str):
    parser = _HTMLTextExtractor()
    parser.feed(html_str or "")
    text = "".join(parser.chunks)
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.splitlines()]
    cleaned = "\n".join(ln for ln in lines if ln)
    return cleaned, parser.links


def extract_links(text, extra_links):
    found = list(extra_links)
    found.extend(re.findall(r"https?://[^\s<>\"')]+", text or ""))
    seen = set()
    unique = []
    for url in found:
        url = url.rstrip(".,;:)")
        if url not in seen:
            seen.add(url)
            unique.append(url)
    return unique


def parse_date_iso(date_str):
    if not date_str:
        return ""
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.isoformat()
    except Exception:
        return date_str


def safe_filename(name):
    cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", (name or "attachment").strip())
    return cleaned.lstrip(".") or "attachment"


def connect(host, port, user, password):
    conn = imaplib.IMAP4_SSL(host, int(port), timeout=15)
    conn.login(user, password)
    return conn


def cmd_folders(conn):
    status, data = conn.list()
    if status != "OK":
        raise RuntimeError("Failed to list IMAP folders")
    folders = []
    for line in data:
        if not line:
            continue
        decoded = line.decode("utf-8", errors="replace")
        m = re.match(r'\(([^)]*)\)\s+"([^"]+)"\s+"?(.+?)"?$', decoded)
        if m:
            folders.append({"flags": m.group(1), "delimiter": m.group(2), "name": m.group(3)})
        else:
            folders.append({"raw": decoded})
    return {"folders": folders}


def _fetch_uids(conn, folder, unread=False, search=None):
    status, _ = conn.select(folder, readonly=True)
    if status != "OK":
        raise RuntimeError(f"Could not open folder '{folder}'")

    criteria = []
    if unread:
        criteria.append("UNSEEN")
    if search:
        safe_q = search.replace('"', '\\"')
        criteria.append(f'OR (OR (SUBJECT "{safe_q}") (FROM "{safe_q}")) (TEXT "{safe_q}")')
    query = " ".join(criteria) if criteria else "ALL"

    if search and not search.isascii():
        try:
            status, data = conn.uid("search", "CHARSET", "UTF-8", query.encode("utf-8"))
        except imaplib.IMAP4.error:
            # Server lacks CHARSET UTF-8; filter recent headers in Python
            base_query = "UNSEEN" if unread else "ALL"
            status, all_data = conn.uid("search", None, base_query)
            if status != "OK":
                raise RuntimeError("IMAP search failed")
            all_uids = all_data[0].decode("ascii", errors="ignore").strip().split()
            recent = all_uids[-200:]
            if not recent:
                return []
            _, fetched = conn.uid("fetch", ",".join(recent), "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO)])")
            needle = search.lower()
            matched = []
            for item in fetched:
                if not isinstance(item, tuple):
                    continue
                meta = item[0].decode("ascii", errors="ignore")
                uid_m = re.search(r"\bUID\s+(\d+)", meta)
                if not uid_m:
                    continue
                msg = email.message_from_bytes(item[1])
                hay = " ".join([
                    decode_mime_str(msg.get("Subject")),
                    decode_mime_str(msg.get("From")),
                    decode_mime_str(msg.get("To")),
                ]).lower()
                if needle in hay:
                    matched.append(uid_m.group(1))
            return matched
    else:
        status, data = conn.uid("search", None, query)

    if status != "OK":
        raise RuntimeError(f"IMAP search failed for query: {query}")

    raw = data[0].decode("ascii", errors="ignore").strip()
    return raw.split() if raw else []


def cmd_list(conn, req):
    folder = req.get("folder") or "INBOX"
    limit = int(req.get("limit") or 15)
    unread = bool(req.get("unread"))
    search = req.get("search") or None

    uids = _fetch_uids(conn, folder, unread=unread, search=search)
    total = len(uids)
    target_uids = list(reversed(uids[-limit:])) if limit > 0 else list(reversed(uids))

    messages = []
    if target_uids:
        uid_set = ",".join(target_uids)
        status, fetched = conn.uid("fetch", uid_set, "(FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE MESSAGE-ID)])")
        if status != "OK":
            raise RuntimeError("Failed to fetch message headers")

        by_uid = {}
        for item in fetched:
            if not isinstance(item, tuple):
                continue
            meta = item[0].decode("ascii", errors="ignore")
            uid_m = re.search(r"\bUID\s+(\d+)", meta)
            if not uid_m:
                continue
            uid = uid_m.group(1)
            flags_m = re.search(r"FLAGS\s+\(([^)]*)\)", meta)
            flags = flags_m.group(1).split() if flags_m else []
            msg = email.message_from_bytes(item[1])
            date_raw = decode_mime_str(msg.get("Date"))
            by_uid[uid] = {
                "uid": int(uid),
                "seen": "\\Seen" in flags,
                "flags": flags,
                "subject": decode_mime_str(msg.get("Subject")) or "(no subject)",
                "from": decode_mime_str(msg.get("From")),
                "to": decode_mime_str(msg.get("To")),
                "date": parse_date_iso(date_raw),
                "dateRaw": date_raw,
            }

        for uid in target_uids:
            if uid in by_uid:
                messages.append(by_uid[uid])

    return {"folder": folder, "totalMatching": total, "messages": messages}


def cmd_read(conn, req):
    folder = req.get("folder") or "INBOX"
    uid = str(req.get("uid"))
    include_html = bool(req.get("includeHtml"))
    save_dir = req.get("saveAttachments") or None

    status, _ = conn.select(folder, readonly=True)
    if status != "OK":
        raise RuntimeError(f"Could not open folder '{folder}'")

    status, fetched = conn.uid("fetch", uid, "(FLAGS BODY.PEEK[])")
    if status != "OK" or not fetched or not isinstance(fetched[0], tuple):
        raise RuntimeError(f"Message UID {uid} not found in {folder}")

    meta = fetched[0][0].decode("ascii", errors="ignore")
    flags_m = re.search(r"FLAGS\s+\(([^)]*)\)", meta)
    flags = flags_m.group(1).split() if flags_m else []
    msg = email.message_from_bytes(fetched[0][1])

    plain_parts = []
    html_parts = []
    attachments = []

    if save_dir:
        os.makedirs(save_dir, exist_ok=True)

    for part in msg.walk():
        if part.is_multipart():
            continue
        disp = (part.get("Content-Disposition") or "").lower()
        ctype = part.get_content_type()
        fname = decode_mime_str(part.get_filename())

        if "attachment" in disp or fname:
            raw_bytes = part.get_payload(decode=True) or b""
            att_info = {
                "index": len(attachments) + 1,
                "filename": fname or f"attachment-{len(attachments) + 1}",
                "contentType": ctype,
                "bytes": len(raw_bytes),
            }
            if save_dir:
                dest = os.path.join(save_dir, safe_filename(att_info["filename"]))
                stem, ext = os.path.splitext(dest)
                suffix = 2
                while os.path.exists(dest):
                    dest = f"{stem}-{suffix}{ext}"
                    suffix += 1
                with open(dest, "wb") as f:
                    f.write(raw_bytes)
                att_info["savedPath"] = dest
            attachments.append(att_info)
        elif ctype == "text/plain":
            plain_parts.append(decode_payload(part))
        elif ctype == "text/html":
            html_parts.append(decode_payload(part))

    html_raw = "\n".join(html_parts).strip()
    html_text, html_links = html_to_text_and_links(html_raw) if html_raw else ("", [])
    text = "\n\n".join(p.strip() for p in plain_parts if p.strip()) or html_text
    links = extract_links(text, html_links)

    date_raw = decode_mime_str(msg.get("Date"))
    result = {
        "uid": int(uid),
        "folder": folder,
        "seen": "\\Seen" in flags,
        "flags": flags,
        "subject": decode_mime_str(msg.get("Subject")) or "(no subject)",
        "from": decode_mime_str(msg.get("From")),
        "to": decode_mime_str(msg.get("To")),
        "cc": decode_mime_str(msg.get("Cc")),
        "date": parse_date_iso(date_raw),
        "dateRaw": date_raw,
        "text": text,
        "links": links,
        "attachments": attachments,
    }
    if include_html and html_raw:
        result["html"] = html_raw
    return result


def main():
    req = json.load(sys.stdin)
    conn = connect(
        req.get("host") or "imap.metu.edu.tr",
        req.get("port") or 993,
        req["username"],
        req["password"],
    )
    try:
        action = req.get("action") or "list"
        if action == "folders":
            out = cmd_folders(conn)
        elif action == "read":
            out = cmd_read(conn, req)
        else:
            out = cmd_list(conn, req)
        print(json.dumps(out, ensure_ascii=False))
    finally:
        try:
            conn.logout()
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
