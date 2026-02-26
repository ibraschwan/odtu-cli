import { Composition } from "remotion";
import { OdtuPromo } from "./OdtuPromo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="OdtuPromo"
      component={OdtuPromo}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
