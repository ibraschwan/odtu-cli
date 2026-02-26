import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const jetbrains = loadJetBrains({ weights: ["400", "700"], subsets: ["latin"] });
const inter = loadInter({ weights: ["400", "600", "800"], subsets: ["latin"] });

export const monoFont = jetbrains.fontFamily;
export const sansFont = inter.fontFamily;
