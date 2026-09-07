import { FocusRail, type FocusRailItem } from "@/components/ui/focus-rail";

// 演示数据：使用 Unsplash 真实图片
const DEMO_ITEMS: FocusRailItem[] = [
  {
    id: 1,
    title: "Neon Tokyo",
    description: "Experience the vibrant nightlife and illuminated streets of Shinjuku.",
    meta: "Urban • Travel",
    imageSrc: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1000&auto=format&fit=crop",
    href: "#tokyo",
  },
  {
    id: 2,
    title: "Nordic Silence",
    description: "Minimalist architecture meeting the raw beauty of the Icelandic coast.",
    meta: "Design • Nature",
    imageSrc: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=1000&auto=format&fit=crop",
    href: "#nordic",
  },
  {
    id: 3,
    title: "Sahara Echoes",
    description: "Wandering through the timeless dunes under an endless golden sun.",
    meta: "Adventure • Heat",
    imageSrc: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1000&auto=format&fit=crop",
    href: "#sahara",
  },
  {
    id: 4,
    title: "Cyber Future",
    description: "A glimpse into a technological singularity where AI meets humanity.",
    meta: "Tech • AI",
    imageSrc: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop",
    href: "#cyber",
  },
  {
    id: 5,
    title: "Deep Ocean",
    description: "The crushing pressure and alien beauty of the Mariana Trench.",
    meta: "Science • Deep",
    imageSrc: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=1000&auto=format&fit=crop",
    href: "#ocean",
  },
];

export default function FocusRailDemo() {
  return (
    <main className="min-h-screen overflow-x-hidden w-full bg-neutral-950 flex flex-col items-center justify-center py-20">
      {/* 标题 */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Featured Stories</h1>
        <p className="text-neutral-400">Navigate the rail to explore selected works.</p>
      </div>

      {/* FocusRail 组件 */}
      <div className="w-full max-w-6xl px-4">
        <FocusRail
          items={DEMO_ITEMS}
          autoPlay={false}
          loop={true}
        />
      </div>
    </main>
  );
}
