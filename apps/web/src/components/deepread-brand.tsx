import { cn } from "@deepread/ui/lib/utils";
import Image from "next/image";

type BrandImageProps = {
	alt?: string;
	className?: string;
	priority?: boolean;
};

export function DeepReadMark({
	alt = "DeepRead",
	className,
	priority = false,
}: BrandImageProps) {
	return (
		<Image
			alt={alt}
			className={cn(
				"size-8 object-contain dark:brightness-0 dark:invert",
				className,
			)}
			height={48}
			priority={priority}
			src="/brand/deepread-mark.png"
			width={48}
		/>
	);
}

export function DeepReadWordmark({
	alt = "DeepRead",
	className,
	priority = false,
}: BrandImageProps) {
	return (
		<Image
			alt={alt}
			className={cn(
				"h-auto w-48 object-contain object-left dark:brightness-0 dark:invert sm:w-56",
				className,
			)}
			height={64}
			priority={priority}
			src="/brand/deepread-wordmark.png"
			width={256}
		/>
	);
}
