import { motion } from "framer-motion";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { CornerBrackets } from "@/components/hud/CornerBrackets";
import { ElementTypeChip } from "./ElementTypeChip";
import { assetUrl } from "@/lib/assetUrl";
import type { Element } from "@/stores/elementsStore";

interface Props {
  element: Element;
  onClick: (element: Element) => void;
}

export function ElementCard({ element, onClick }: Props) {
  const imageUrl = assetUrl(element.thumbnail);

  return (
    <motion.button
      type="button"
      onClick={() => onClick(element)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative text-left",
        "border border-border-hud bg-bg-panel/60 backdrop-blur-md",
        "hover:border-hud-cyan/60 hover:hud-glow-cyan transition-all",
        "hud-scanline-sweep overflow-hidden hud-focus",
      )}
    >
      <CornerBrackets size={10} inset={-1} color="var(--color-hud-cyan)" />

      <div className="relative aspect-square bg-bg-elevated overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={element.display_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center hud-grid-bg">
            <ImageIcon className="w-8 h-8 text-fg-dim" strokeWidth={1.2} />
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-bg-base/80 backdrop-blur-sm border border-border-hud px-1.5 py-0.5">
          <span className="font-mono text-[0.55rem] text-fg-muted">
            {element.images.length}/9
          </span>
        </div>
      </div>

      <div className="p-3 space-y-1.5 border-t border-border-hud">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-hud-cyan truncate hud-text-glow-cyan">
            @{element.tag}
          </span>
          <ElementTypeChip type={element.type} />
        </div>
        <div className="font-sans text-[0.85rem] text-fg truncate">
          {element.display_name}
        </div>
      </div>
    </motion.button>
  );
}
