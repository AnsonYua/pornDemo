"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SceneId = "intro" | "meadow" | "forest";

const scenes: Record<SceneId, { src: string; chapter: string }> = {
  intro: { src: "/video/intro.mp4", chapter: "THE CROSSROADS" },
  meadow: { src: "/video/meadow.mp4", chapter: "THE OPEN PATH" },
  forest: { src: "/video/forest.mp4", chapter: "THE HIDDEN PATH" },
};

export default function BranchingVideoGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shownForRef = useRef<string | null>(null);
  const [sceneId, setSceneId] = useState<SceneId>("intro");
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [needsResume, setNeedsResume] = useState(false);
  const [choicesVisible, setChoicesVisible] = useState(false);

  const playScene = useCallback(async (next: SceneId, restart = false) => {
    const video = videoRef.current;
    if (!video) return;
    shownForRef.current = null;
    setChoicesVisible(false);
    window.dispatchEvent(new CustomEvent("wildpath:hide-choices"));
    if (next !== sceneId) setSceneId(next);
    if (restart || next === sceneId) {
      video.currentTime = 0;
      try {
        await video.play();
        setNeedsResume(false);
      } catch {
        setNeedsResume(true);
      }
    }
  }, [sceneId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    void video.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video) return;
    video.load();
    video.muted = muted;
    void video.play().then(() => setNeedsResume(false)).catch(() => setNeedsResume(true));
    window.dispatchEvent(new CustomEvent("wildpath:chapter", {
      detail: scenes[sceneId].chapter,
    }));
  }, [sceneId, started, muted]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const choice = (event as CustomEvent<string>).detail;
      if (choice === "meadow" || choice === "forest" || choice === "intro") {
        void playScene(choice);
      } else if (choice === "restart") {
        void playScene(sceneId, true);
      }
    };
    window.addEventListener("wildpath:select", onSelect);
    return () => window.removeEventListener("wildpath:select", onSelect);
  }, [playScene, sceneId]);

  useEffect(() => {
    let game: import("phaser").Game | undefined;
    let cancelled = false;

    void import("phaser").then((module) => {
      if (cancelled || !mountRef.current) return;
      const Phaser = module.default;

      class OverlayScene extends Phaser.Scene {
        private chapter?: import("phaser").GameObjects.Text;
        private choiceObjects: import("phaser").GameObjects.GameObject[] = [];
        private options: string[] = [];
        private onShow?: EventListener;
        private onHide?: EventListener;
        private onChapter?: EventListener;

        constructor() {
          super("overlay");
        }

        create() {
          this.chapter = this.add.text(24, 28, "THE CROSSROADS", {
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            color: "#fff5df",
            letterSpacing: 3,
          }).setShadow(0, 2, "#000000", 5).setDepth(5);

          this.add.text(24, 51, "WILDPATH / 01", {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#eab76a",
            letterSpacing: 2,
          }).setShadow(0, 2, "#000000", 4).setDepth(5);

          this.onShow = ((event: CustomEvent<{ options: { id: string; label: string; hint: string }[] }>) => {
            this.showChoices(event.detail.options);
          }) as EventListener;
          this.onHide = (() => this.hideChoices()) as EventListener;
          this.onChapter = ((event: CustomEvent<string>) => {
            this.chapter?.setText(event.detail);
          }) as EventListener;

          window.addEventListener("wildpath:show-choices", this.onShow);
          window.addEventListener("wildpath:hide-choices", this.onHide);
          window.addEventListener("wildpath:chapter", this.onChapter);
          this.input.keyboard?.on("keydown-ONE", () => this.selectByIndex(0));
          this.input.keyboard?.on("keydown-TWO", () => this.selectByIndex(1));
          this.scale.on("resize", () => {
            if (this.choiceObjects.length) this.hideChoices();
          });
        }

        selectByIndex(index: number) {
          const id = this.options[index];
          if (id) window.dispatchEvent(new CustomEvent("wildpath:select", { detail: id }));
        }

        hideChoices() {
          this.choiceObjects.forEach((object) => object.destroy());
          this.choiceObjects = [];
          this.options = [];
        }

        showChoices(options: { id: string; label: string; hint: string }[]) {
          this.hideChoices();
          this.options = options.map((option) => option.id);
          const width = this.scale.width;
          const height = this.scale.height;
          const compact = width < 640;
          const cardWidth = Math.min(compact ? width - 36 : 320, 360);
          const gap = 12;
          const totalWidth = compact ? cardWidth : cardWidth * 2 + gap;
          const startX = (width - totalWidth) / 2;
          const y = compact ? height - 218 : height - 148;

          const prompt = this.add.text(width / 2, y - 38, "雖然你按左門鐘，女戶主依然係屋裡面搞野唔出黎拎，你好大機會因為咁而比平台扣錢，你會點做？", {
            fontFamily: "Arial, sans-serif",
            fontStyle: "bold",
            fontSize: compact ? "13px" : "14px",
            color: "#fff5df",
            letterSpacing: 3,
          }).setOrigin(0.5).setShadow(0, 2, "#000000", 6).setDepth(10);
          this.choiceObjects.push(prompt);

          options.forEach((option, index) => {
            const x = compact ? startX : startX + index * (cardWidth + gap);
            const cardY = compact ? y + index * 82 : y;
            const panel = this.add.rectangle(x, cardY, cardWidth, 70, 0x11140f, 0.88)
              .setOrigin(0, 0)
              .setStrokeStyle(1, index === 0 ? 0xeab76a : 0x8d927f, 0.9)
              .setInteractive({ useHandCursor: true })
              .setDepth(10);
            const number = this.add.text(x + 16, cardY + 13, `0${index + 1}`, {
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#eab76a",
            }).setDepth(11);
            const label = this.add.text(x + 50, cardY + 10, option.label, {
              fontFamily: "Arial, sans-serif",
              fontStyle: "bold",
              fontSize: "17px",
              color: "#fffaf0",
            }).setDepth(11);
            const hint = this.add.text(x + 50, cardY + 37, option.hint, {
              fontFamily: "Arial, sans-serif",
              fontSize: "11px",
              color: "#b7baa9",
            }).setDepth(11);
            panel.on("pointerover", () => panel.setFillStyle(0x292d20, 0.95));
            panel.on("pointerout", () => panel.setFillStyle(0x11140f, 0.88));
            panel.on("pointerdown", () => {
              window.dispatchEvent(new CustomEvent("wildpath:select", { detail: option.id }));
            });
            this.choiceObjects.push(panel, number, label, hint);
          });
        }

        shutdown() {
          if (this.onShow) window.removeEventListener("wildpath:show-choices", this.onShow);
          if (this.onHide) window.removeEventListener("wildpath:hide-choices", this.onHide);
          if (this.onChapter) window.removeEventListener("wildpath:chapter", this.onChapter);
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: mountRef.current,
        width: window.innerWidth,
        height: window.innerHeight,
        transparent: true,
        backgroundColor: "rgba(0,0,0,0)",
        scene: OverlayScene,
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 3 },
        render: { antialias: true, transparent: true },
      });
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  const startGame = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    setMuted(false);
    setStarted(true);
    try {
      await video.play();
      setNeedsResume(false);
    } catch {
      setNeedsResume(true);
    }
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !started || !Number.isFinite(video.duration)) return;
    const choiceTime = sceneId === "intro" ? 16.5 : video.duration - 2.7;
    if (video.currentTime < choiceTime || shownForRef.current === sceneId) return;
    shownForRef.current = sceneId;
    setChoicesVisible(true);
    const options = sceneId === "intro"
      ? [
          { id: "meadow", label: "將女戶主的呻吟聲錄底", hint: "" },
          { id: "forest", label: "安靜怕羞地等女戶主出來到", hint: "" },
        ]
      : [
          { id: "restart", label: "Replay this path", hint: "Look for another clue" },
          { id: "intro", label: "Return to the fork", hint: "Choose a different fate" },
        ];
    window.dispatchEvent(new CustomEvent("wildpath:show-choices", { detail: { options } }));
  };

  const resume = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsResume(false);
    } catch {
      setNeedsResume(true);
    }
  };

  return (
    <main className="game-shell">
      <video
        ref={videoRef}
        className="game-video"
        src={scenes[sceneId].src}
        playsInline
        preload="auto"
        muted={muted}
        onTimeUpdate={onTimeUpdate}
        onEnded={onTimeUpdate}
        aria-label="Interactive story video"
      />
      {choicesVisible && <div className="choice-grade" aria-hidden="true" />}
      <div ref={mountRef} className="phaser-layer" aria-label="Game choices" />

      <div className="top-controls">
        <span className="live-mark"><i /> INTERACTIVE FILM</span>
        {started && (
          <button
            className="icon-button"
            onClick={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              if (videoRef.current) videoRef.current.muted = nextMuted;
            }}
            aria-label={muted ? "Turn sound on" : "Mute sound"}
          >
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
        )}
      </div>

      {!started && (
        <section className="start-screen">
          <p className="eyebrow">A PHASER 3 VIDEO EXPERIENCE</p>
          <h1>WILDPATH</h1>
          <p className="intro-copy">One trail. Two instincts. Your choice changes what plays next.</p>
          <button className="start-button" onClick={startGame}>
            <span>BEGIN WITH SOUND</span>
            <b>→</b>
          </button>
          <p className="tap-note">Tap once to unlock audio on mobile</p>
        </section>
      )}

      {needsResume && started && (
        <button className="resume-button" onClick={resume}>Tap to continue</button>
      )}

      <footer className="credit">Sample film: Big Buck Bunny · Blender Foundation · CC BY 3.0</footer>
    </main>
  );
}
