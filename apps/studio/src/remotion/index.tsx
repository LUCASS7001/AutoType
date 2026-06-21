import { Composition, registerRoot } from "remotion";
import type { ExportSettings } from "@autotype/core";
import { dimensionsFor } from "../lib/format";
import { sampleSession } from "../lib/sampleSession";
import { RecordingVideo, type RecordingVideoProps } from "./RecordingVideo";

const defaultProps: RecordingVideoProps = {
  session: sampleSession,
  cameraMode: "ai-director",
  preset: "lovable",
  theme: "GitHub Dark",
  settings: { format: "mp4", resolution: "1080p", fps: 60 },
};

function VideoRoot() {
  return (
    <Composition
      id="AutoTypeRecording"
      component={RecordingVideo}
      defaultProps={defaultProps}
      durationInFrames={Math.ceil(sampleSession.duration * 60)}
      fps={60}
      width={1920}
      height={1080}
      calculateMetadata={({ props }) => {
        const settings = props.settings as ExportSettings;
        const dimensions = dimensionsFor(settings.resolution);
        return {
          durationInFrames: Math.max(1, Math.ceil(props.session.duration * settings.fps)),
          fps: settings.fps,
          width: dimensions.width,
          height: dimensions.height,
        };
      }}
    />
  );
}

registerRoot(VideoRoot);
