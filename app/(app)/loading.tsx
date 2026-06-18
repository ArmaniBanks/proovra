import { ProoVraMark } from "@/components/brand/proovra-mark";

export default function Loading() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <ProoVraMark size={44} priority />
        <span className="text-xs font-medium uppercase tracking-[0.24em] text-amber-400">
          Verifying
        </span>
      </div>
    </div>
  );
}
