import { Facebook, Instagram, Linkedin, Link2, Send, Youtube } from "lucide-react";
import { normalizeSocialUrl, socialPlatform, type SocialLink, type SocialPlatform } from "@/lib/socials";

/**
 * Icon row for the studio's social profiles.
 *
 * lucide has no TikTok, X, Threads or WhatsApp glyph, so those are drawn here
 * as small inline paths — a link that renders as a generic chain icon reads as
 * broken, and these four are the ones this studio actually lives on.
 */

function TikTok(props: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size} height={props.size} fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .53.04.78.12v-3.16a5.71 5.71 0 0 0-.78-.05 5.69 5.69 0 1 0 5.69 5.69V9.01a7.35 7.35 0 0 0 4.29 1.37V7.3a4.29 4.29 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

function XMark(props: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size} height={props.size} fill="currentColor" aria-hidden>
      <path d="M17.53 3H20l-5.4 6.17L21 21h-5.06l-3.96-5.2L7.44 21H4.96l5.78-6.6L3.3 3h5.19l3.58 4.73L17.53 3Zm-.87 16.5h1.37L8.4 4.42H6.93L16.66 19.5Z" />
    </svg>
  );
}

function Threads(props: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size} height={props.size} fill="currentColor" aria-hidden>
      <path d="M12.2 22h-.05c-3.02-.02-5.34-1.02-6.9-2.96C3.84 17.3 3.12 14.86 3.1 12v-.02c.02-2.86.74-5.3 2.15-7.03C6.81 3.02 9.13 2.02 12.15 2h.05c2.32.02 4.25.62 5.75 1.79 1.4 1.1 2.39 2.66 2.94 4.65l-1.85.52c-.93-3.33-3.28-5.03-6.85-5.05-2.42.02-4.24.79-5.42 2.28-1.1 1.4-1.67 3.4-1.69 5.81.02 2.41.59 4.42 1.7 5.81 1.17 1.49 3 2.26 5.41 2.28 2.18-.02 3.62-.53 4.82-1.72 1.37-1.35 1.34-3.01 .9-4.02-.26-.6-.73-1.09-1.36-1.47-.16 1.13-.52 2.04-1.07 2.73-.74.92-1.79 1.42-3.13 1.49-1.01.06-1.99-.18-2.74-.67-.89-.58-1.41-1.47-1.47-2.5-.11-2.04 1.51-3.5 4.04-3.65.9-.05 1.74-.01 2.51.12-.1-.62-.31-1.11-.62-1.46-.42-.48-1.08-.72-1.95-.73h-.03c-.7 0-1.65.19-2.26 1.09l-1.57-1.06c.81-1.2 2.13-1.87 3.83-1.87h.04c2.85.02 4.54 1.76 4.71 4.8l-.01.01.06.03c1.2.56 2.08 1.42 2.55 2.48.65 1.48.71 3.9-1.25 5.83-1.5 1.47-3.32 2.14-5.9 2.16ZM13 12.6c-.19 0-.38.01-.58.02-1.9.11-2.32.99-2.28 1.66.05.87.97 1.28 1.86 1.23 1.61-.09 2.34-.85 2.55-2.72-.47-.12-1-.19-1.55-.19Z" />
    </svg>
  );
}

function WhatsApp(props: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size} height={props.size} fill="currentColor" aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.19-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.1 15.08l-.29-.17-3.08.89.9-3-.19-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 4c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.7 2.72 4.19 3.7 2.07.82 2.49.66 2.94.62.45-.04 1.45-.59 1.65-1.17.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.77.96-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.32-.75-1.8-.19-.46-.39-.4-.54-.41h-.47Z" />
    </svg>
  );
}

const ICONS: Record<SocialPlatform, (props: { size: number }) => React.ReactElement> = {
  instagram: (p) => <Instagram size={p.size} />,
  tiktok: TikTok,
  youtube: (p) => <Youtube size={p.size} />,
  linkedin: (p) => <Linkedin size={p.size} />,
  facebook: (p) => <Facebook size={p.size} />,
  x: XMark,
  threads: Threads,
  whatsapp: WhatsApp,
  telegram: (p) => <Send size={p.size} />,
  generic: (p) => <Link2 size={p.size} />,
};

export default function SocialLinks({
  links,
  size = 18,
  className = "",
}: {
  links: SocialLink[];
  size?: number;
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className}`}>
      {links.map((link) => {
        const Icon = ICONS[socialPlatform(link)];
        return (
          <li key={`${link.label}-${link.url}`}>
            <a
              href={normalizeSocialUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer me"
              // The label is the accessible name — an icon-only link with no
              // name is unusable with a screen reader — and the tooltip, since
              // the studio may add profiles whose icon says nothing.
              aria-label={link.label}
              title={link.label}
              className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted transition-colors duration-300 hover:border-accent-soft hover:text-fg"
            >
              <Icon size={size} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
