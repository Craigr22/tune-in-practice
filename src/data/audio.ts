import sunshine from "@/assets/audio/sunshine.mp3";
import piyuBole from "@/assets/audio/piyu-bole.mp3";
import photograph from "@/assets/audio/photograph.mp3";
import imYours from "@/assets/audio/im-yours.mp3";
import kaisiPaheli from "@/assets/audio/kaisi-paheli.mp3";
import kaisiPaheliFull from "@/assets/audio/kaisi-paheli-full.mp3";
import khoGaye from "@/assets/audio/kho-gaye.mp3";
import overRainbow from "@/assets/audio/over-rainbow.mp3";
import sham from "@/assets/audio/sham.mp3";
import shamFull from "@/assets/audio/sham-full.mp3";

export const SONG_AUDIO: Record<string, { src: string; fullSrc?: string }> = {
  "sunshine": { src: sunshine },
  "piyu-bole": { src: piyuBole },
  "photograph": { src: photograph },
  "im-yours": { src: imYours },
  "kaisi-paheli": { src: kaisiPaheli, fullSrc: kaisiPaheliFull },
  "kho-gaye": { src: khoGaye },
  "over-rainbow": { src: overRainbow },
  "sham": { src: sham, fullSrc: shamFull },
};
