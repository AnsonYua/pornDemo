import type { Metadata } from "next";
import BranchingVideoGame from "./BranchingVideoGame";

export const metadata: Metadata = {
  title: "Wildpath — Interactive Video Demo",
  description: "A mobile-first branching video role-play demo powered by Phaser 3.",
};

export default function Home() {
  return <BranchingVideoGame />;
}
