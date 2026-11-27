import type { ReactNode } from "react";
import Image from "next/image";

type ImageScreen = { src: string; alt: string; width: number; height: number; sizes: string; preload?: boolean; children?: never };
/** Anything else as the screen, e.g. the hero's sliding carousel track. */
type CustomScreen = { children: ReactNode; src?: never };

/**
 * A phone-shaped frame around an app screenshot, built in three layers like a real handset:
 * a thin metal rim, a black glass bezel, then the screen. The screen has a Dynamic Island
 * (with camera lens) in a status-bar strip above the screenshot so it never covers app content,
 * and the rim carries the action + volume buttons on the left and the power button on the right.
 *
 * Width comes from `className`. The wrapper is a size container, so every dimension below is in
 * `cqw` (1% of the phone's width) and the whole frame keeps its proportions at any size.
 */
export function PhoneFrame({
  className = "",
  shadow = "shadow-[0_18px_40px_rgba(0,0,0,0.12)]",
  ...screen
}: (ImageScreen | CustomScreen) & { className?: string; shadow?: string }) {
  // Side buttons: same metal as the rim, just outside it. Positions are a share of the height.
  const metal = "bg-[linear-gradient(90deg,#3c3c40,#6e6e74_50%,#3c3c40)]";
  const button = `absolute w-[1.1cqw] ${metal}`;
  const left = `${button} -left-[0.9cqw] rounded-l-[0.6cqw]`;
  return (
    <div className={`relative [container-type:inline-size] ${className}`}>
      <span aria-hidden="true" className={`${left} top-[15%] h-[4%]`} />
      <span aria-hidden="true" className={`${left} top-[22%] h-[7.5%]`} />
      <span aria-hidden="true" className={`${left} top-[31%] h-[7.5%]`} />
      <span aria-hidden="true" className={`${button} -right-[0.9cqw] top-[25%] h-[11%] rounded-r-[0.6cqw]`} />

      {/* Metal rim: a diagonal gradient gives it a brushed highlight on one side. */}
      <div
        className={`relative rounded-[16cqw] bg-[linear-gradient(135deg,#7a7a80_0%,#3a3a3e_30%,#2a2a2d_60%,#6a6a70_100%)] p-[1.1cqw] ${shadow}`}
      >
        {/* Black glass bezel. */}
        <div className="rounded-[15cqw] bg-[#0b0b0c] p-[3.2cqw]">
          {/* Screen. */}
          <div className="overflow-hidden rounded-[12cqw] bg-[#f6f5f2]">
            {/* Status-bar strip with the Dynamic Island and its camera lens. */}
            <div className="relative h-[13cqw]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 mx-auto flex aspect-[3.4/1] w-[29%] -translate-y-1/2 items-center justify-end rounded-full bg-[#0b0b0c] pr-[2.2cqw]"
              >
                <span className="aspect-square h-[44%] rounded-full bg-[radial-gradient(circle_at_35%_35%,#3b4a6b_0%,#1c2333_45%,#0a0c12_100%)] ring-1 ring-[#23272f]" />
              </span>
            </div>
            {screen.src !== undefined ? (
              <Image
                src={screen.src}
                alt={screen.alt}
                width={screen.width}
                height={screen.height}
                sizes={screen.sizes}
                preload={screen.preload}
                className="block h-auto w-full"
              />
            ) : (
              screen.children
            )}
            {/* Home-indicator strip in the tab bar's colour; keeps the corners from clipping its labels. */}
            <div className="relative h-[7cqw] bg-[#f9f8f6]">
              <span aria-hidden="true" className="absolute inset-x-0 top-1/2 mx-auto h-[1.3cqw] w-[34%] -translate-y-1/2 rounded-full bg-[#111]" />
            </div>
          </div>
        </div>
      </div>

      {/* Soft contact shadow on the "floor" under the phone. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[7cqw] left-1/2 h-[5cqw] w-[70%] -translate-x-1/2 rounded-[50%] bg-black/25 blur-[3cqw]"
      />
    </div>
  );
}
