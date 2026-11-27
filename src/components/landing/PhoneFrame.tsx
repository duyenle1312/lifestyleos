import Image from "next/image";

/**
 * A phone-shaped frame around an app screenshot: thin black bezel, a Dynamic Island in a
 * status-bar strip above the screenshot (so it never covers app content), and the action +
 * volume buttons on the left edge. Width comes from `className`; everything else scales with it.
 */
export function PhoneFrame({
  src,
  alt,
  width,
  height,
  sizes,
  preload,
  className = "",
  shadow = "shadow-[0_18px_40px_rgba(0,0,0,0.12)]",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  preload?: boolean;
  className?: string;
  shadow?: string;
}) {
  // Side buttons sit just outside the bezel; their positions are a share of the phone's height.
  const button = "absolute -left-[3px] w-[3px] rounded-l-sm bg-[#111]";
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden="true" className={`${button} top-[14%] h-[4%]`} />
      <span aria-hidden="true" className={`${button} top-[21%] h-[7%]`} />
      <span aria-hidden="true" className={`${button} top-[30%] h-[7%]`} />
      <div className={`overflow-hidden rounded-[28px] border-4 border-[#111] bg-[#f6f5f2] ${shadow}`}>
        {/* Status-bar strip (height is a share of the width, so it scales with the phone). */}
        <div className="relative h-0 pb-[11%]">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 mx-auto aspect-[3.4/1] w-[30%] -translate-y-1/2 rounded-full bg-[#111]"
          />
        </div>
        <Image src={src} alt={alt} width={width} height={height} sizes={sizes} preload={preload} className="block h-auto w-full" />
        {/* Home-indicator strip in the tab bar's colour; keeps the corners from clipping its labels. */}
        <div className="relative h-0 bg-[#f9f8f6] pb-[7%]">
          <span aria-hidden="true" className="absolute inset-x-0 top-1/2 mx-auto h-[3px] w-[34%] -translate-y-1/2 rounded-full bg-[#111]" />
        </div>
      </div>
    </div>
  );
}
