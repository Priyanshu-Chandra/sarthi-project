import React from "react";
import { Separator } from "react-resizable-panels";

/**
 * ResizeHandle (Elite V5 Premium)
 * ─────────────────────────────────────────────────────────────────────────────
 * A specialized handle component for the resizable split-pane system.
 * Features a minimalist vertical/horizontal bar that glows on hover.
 */
const ResizeHandle = ({ direction = "horizontal", className = "" }) => (
  <Separator
    className={`flex items-center justify-center transition-all group shrink-0 ${
      direction === "horizontal" 
        ? "w-1.5 hover:w-2 border-x border-richblack-700/30 hover:bg-yellow-50/5" 
        : "h-1.5 hover:h-2 border-y border-richblack-700/30 hover:bg-yellow-50/5"
    } ${className}`}
  >
    <div className={`bg-richblack-700 group-hover:bg-yellow-50/40 rounded-full transition-all ${
      direction === "horizontal" ? "w-[1.5px] h-10" : "h-[1.5px] w-10"
    }`} />
  </Separator>
);

export default ResizeHandle;
