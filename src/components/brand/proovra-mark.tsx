import Image from "next/image";

type ProoVraMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function ProoVraMark({
  size = 32,
  className = "",
  priority = false,
}: ProoVraMarkProps) {
  return (
    <Image
      src="/proovra-logo.png"
      alt="ProoVra"
      width={size}
      height={size}
      priority={priority}
      className={`rounded-md object-cover ${className}`}
    />
  );
}
