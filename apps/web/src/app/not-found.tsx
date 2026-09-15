import Link from "next/link";
import { FaAnchor, FaHome, FaUtensils } from "react-icons/fa";

export default function NotFound() {
  const creatures = [
    { name: "Snapper", emoji: "🐟", top: "15%", speed: "20s", delay: "0s", dir: "right" },
    { name: "Flake", emoji: "🦈", top: "25%", speed: "25s", delay: "4s", dir: "left" },
    { name: "Blue Grenadier", emoji: "🐟", top: "35%", speed: "28s", delay: "1s", dir: "right" },
    { name: "Barramundi", emoji: "🐟", top: "45%", speed: "22s", delay: "2s", dir: "right" },
    { name: "Butterfish", emoji: "🐠", top: "60%", speed: "18s", delay: "7s", dir: "left" },
    { name: "Whiting", emoji: "🐡", top: "75%", speed: "15s", delay: "1s", dir: "right" },
    { name: "Octopus", emoji: "🐙", top: "85%", speed: "30s", delay: "5s", dir: "left" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-cyan-900 via-blue-900 to-indigo-950">
      <style>{`
        @keyframes swim-right {
          0% { transform: translateX(-20vw) scaleX(-1) translateY(0); }
          50% { transform: translateX(50vw) scaleX(-1) translateY(-20px); }
          100% { transform: translateX(120vw) scaleX(-1) translateY(0); }
        }
        @keyframes swim-left {
          0% { transform: translateX(120vw) translateY(0); }
          50% { transform: translateX(50vw) translateY(20px); }
          100% { transform: translateX(-20vw) translateY(0); }
        }
        @keyframes bubbles {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>

      {/* Bubbles */}
      {[...Array(10)].map((_, i) => (
        <div
          key={`bubble-${i}`}
          className="absolute w-4 h-4 bg-white/20 rounded-full blur-[1px]"
          style={{
            left: `${Math.random() * 100}%`,
            animation: `bubbles ${10 + Math.random() * 10}s linear infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}

      {/* Swimming Creatures */}
      {creatures.map((c, i) => (
        <div
          key={i}
          className="absolute flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity z-0"
          style={{
            top: c.top,
            animation: `${c.dir === "right" ? "swim-right" : "swim-left"} ${c.speed} linear infinite`,
            animationDelay: c.delay,
            whiteSpace: "nowrap"
          }}
        >
          {c.dir === "left" && <span className="text-white/60 font-medium text-sm drop-shadow-md">{c.name}</span>}
          <span className="text-4xl drop-shadow-xl">{c.emoji}</span>
          {c.dir === "right" && <span className="text-white/60 font-medium text-sm drop-shadow-md scale-x-[-1]">{c.name}</span>}
        </div>
      ))}

      <div className="relative z-10 w-full max-w-lg text-center backdrop-blur-sm bg-blue-950/20 p-10 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center">
        <div className="inline-flex items-center justify-center w-24 h-24 mb-6 rounded-full bg-cyan-900/40 text-cyan-400 shadow-[0_8px_30px_rgb(0,0,0,0.2)] border-4 border-blue-950/50 backdrop-blur-md animate-[bob_4s_ease-in-out_infinite]">
          <FaAnchor className="w-10 h-10 -ml-1 mt-1 transform -rotate-12 hover:rotate-0 transition-transform duration-500" />
        </div>
        
        <h1 className="text-6xl sm:text-8xl font-bold font-serif text-amber-500 mb-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
          404
        </h1>
        
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-serif drop-shadow-md">
          Oh buoy! Lost at sea.
        </h2>
        
        <p className="text-lg text-cyan-100/80 mb-10 max-w-md mx-auto leading-relaxed">
          We can&apos;t seem to find the page you&apos;re looking for. It might have drifted away with the tide to the bottom of the ocean.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="w-full sm:w-auto h-14 px-8 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-blue-950 font-bold transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-1"
          >
            <FaHome className="w-5 h-5" />
            Back to Shore
          </Link>
          <Link
            href="/menu"
            className="w-full sm:w-auto h-14 px-8 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-900/40 hover:bg-blue-800/60 text-cyan-300 font-bold border-2 border-cyan-500/30 hover:border-cyan-400 transition-all shadow-sm hover:-translate-y-1 backdrop-blur-md"
          >
            <FaUtensils className="w-5 h-5" />
            View Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
