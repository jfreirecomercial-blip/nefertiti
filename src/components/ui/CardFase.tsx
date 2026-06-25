"use client";

import React, { useState } from "react";
import { Plus, Sparkles } from "lucide-react";

export interface CardFaseProps {
  phaseName?: string;
  phaseDay?: number;
  phaseDuration?: number;
  nutritionSuggestion?: {
    title: string;
    description: string;
    foods: string[];
  };
  waterIntakeMl?: number;
  waterTargetMl?: number;
  onAddWater?: (amount: number) => void;
}

export default function CardFase({
  phaseName = "Fase Folicular",
  phaseDay = 7,
  phaseDuration = 14,
  nutritionSuggestion = {
    title: "Nutrição Regenerativa",
    description: "Sua energia está ascendendo com o aumento do estrogênio. Foque em alimentos leves que estimulam a digestão e fornecem micronutrientes essenciais.",
    foods: ["Broto de brócolis", "Sementes de girassol", "Abacate orgânico", "Frutas vermelhas"],
  },
  waterIntakeMl: initialWater = 850,
  waterTargetMl = 2500,
  onAddWater,
}: CardFaseProps) {
  const [water, setWater] = useState(initialWater);
  const [isWaterRipple, setIsWaterRipple] = useState(false);

  const handleAddWater = () => {
    const amount = 250;
    setWater((prev) => {
      const next = Math.min(prev + amount, waterTargetMl);
      if (onAddWater) onAddWater(amount);
      return next;
    });
    setIsWaterRipple(true);
    setTimeout(() => setIsWaterRipple(false), 800);
  };

  const progressRatio = phaseDay / phaseDuration;
  const waterPercentage = Math.min((water / waterTargetMl) * 100, 100);

  // Custom path for the cycle wave line (curved, organic feel)
  // We represent the 14 days of follicular phase as a gentle rising wave
  const wavePath = "M 10 40 Q 100 10 200 45 T 390 20";
  // Calculate marker position along the wave path roughly
  const markerX = 10 + (380 * progressRatio);
  const markerY = 40 - (20 * Math.sin(progressRatio * Math.PI));

  return (
    <div className="relative group bg-ivory border border-sand-200/50 rounded-[2.5rem] p-8 lg:p-10 shadow-[0_8px_30px_rgb(238,222,185,0.15)] hover:shadow-[0_20px_50px_rgb(238,222,185,0.3)] transition-all duration-700 max-w-md w-full overflow-hidden">
      {/* Decorative blurred gradient background meshes (no harsh boundaries, very organic) */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-quartz-100/50 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000 ease-out" />
      <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-olive-100/40 rounded-full blur-3xl" />
      
      {/* Editorial Header */}
      <div className="relative flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-quartz-300 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-spa-light">
              Ritmo Interno
            </span>
          </div>
          <h3 className="font-serif text-4xl text-spa-dark font-light tracking-wide italic">
            {phaseName}
          </h3>
        </div>
        <div className="p-2.5 bg-white/50 backdrop-blur-sm border border-sand-200/30 rounded-full group-hover:rotate-12 transition-transform duration-500 flex items-center justify-center w-12 h-12">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-7 h-7 filter drop-shadow-[0_2px_4px_rgba(234,147,155,0.25)]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="rosePetalGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#EA939B" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#F19FA5" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#FDF1F1" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="roseVeinGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#DC6B74" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#EA939B" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            <path
              d="M 12 21.5 C 9.5 18 3.5 14 3.5 9 C 3.5 5 7 2 12 3.8 C 17 2 20.5 5 20.5 9 C 20.5 14 14.5 18 12 21.5 Z"
              fill="url(#rosePetalGradient)"
              stroke="#EA939B"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            <path
              d="M 12 21 C 12.2 16.5 12.5 11 12 4.5"
              stroke="url(#roseVeinGradient)"
              strokeWidth="0.75"
              strokeLinecap="round"
            />
            <path
              d="M 11.5 16.5 C 9.5 14.5 7.5 11.5 6.5 9"
              stroke="url(#roseVeinGradient)"
              strokeWidth="0.5"
              strokeLinecap="round"
            />
            <path
              d="M 12.5 15 C 14.5 13 16.5 10.5 17.5 8"
              stroke="url(#roseVeinGradient)"
              strokeWidth="0.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Cycle Progress - Artistic Curved Wave instead of a boring bar */}
      <div className="relative mb-10">
        <div className="flex justify-between text-[11px] font-medium text-spa-light tracking-wider mb-4">
          <span>Dia {phaseDay} de {phaseDuration}</span>
          <span className="italic">Crescimento Folicular</span>
        </div>
        
        <div className="relative h-16 w-full flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 400 60" fill="none">
            {/* Base wave path */}
            <path
              d={wavePath}
              stroke="#F4ECE1"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Active filled wave path */}
            <path
              d={wavePath}
              stroke="url(#waveGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="400"
              strokeDashoffset={400 - (400 * progressRatio)}
              className="transition-all duration-1000 ease-out"
            />
            
            {/* The "Pearl" tracking indicator */}
            <circle
              cx={markerX}
              cy={markerY}
              r="6"
              fill="#FDFDFB"
              stroke="#EA939B"
              strokeWidth="3.5"
              className="shadow-sm transition-all duration-1000 ease-out"
            />

            {/* Gradients */}
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FAE0E2" />
                <stop offset="50%" stopColor="#EA939B" />
                <stop offset="100%" stopColor="#D6BAE6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Nutrition Suggestions - Editorial Magazine layout */}
      <div className="relative border-t border-sand-100/60 pt-8 mb-10">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-serif text-lg italic text-spa-dark">
            {nutritionSuggestion.title}
          </h4>
          <span className="text-[10px] font-bold uppercase tracking-widest text-olive-500 bg-olive-50 px-2.5 py-1 rounded-md border border-olive-100">
            Foco Bioquímico
          </span>
        </div>
        <p className="text-xs text-spa-light leading-relaxed mb-6 font-light">
          {nutritionSuggestion.description}
        </p>
        
        {/* Understated Minimal List instead of tags */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 border-b border-sand-100/40 pb-6">
          {nutritionSuggestion.foods.map((food, index) => (
            <div key={index} className="flex items-center gap-2 text-xs text-spa-medium font-medium group/item">
              <span className="w-1.5 h-1.5 rounded-full bg-olive-300 group-hover/item:scale-150 transition-transform duration-300" />
              <span className="group-hover/item:text-olive-600 transition-colors duration-200">{food}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hydration / Water Tracker - Interactive Liquid Vessel */}
      <div className="relative flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-spa-light mb-1">
            Hidratação Ritual
          </h4>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-3xl font-light text-spa-dark italic">{water}</span>
            <span className="text-xs text-spa-light font-light">/ {waterTargetMl}ml</span>
          </div>
        </div>

        {/* Custom Liquid Vessel Circle */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full border border-sand-200/50 bg-white/40 overflow-hidden shadow-inner flex items-center justify-center">
            {/* Waves Container clipping */}
            <div 
              className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-quartz-200 to-quartz-100 transition-all duration-700 ease-out overflow-hidden"
              style={{ height: `${waterPercentage}%` }}
            >
              {/* Animated wave effect using SVG inside */}
              <div className={`absolute top-0 left-[-50%] w-[200%] h-6 bg-quartz-100 rounded-[38%] opacity-70 liquid-wave ${isWaterRipple ? "animate-pulse" : ""}`} />
              <div className="absolute top-[-2px] left-[-30%] w-[180%] h-6 bg-quartz-200 rounded-[40%] liquid-wave" style={{ animationDelay: "2s" }} />
            </div>
            
            {/* Glowing percentage count */}
            <span className="relative z-10 text-[11px] font-bold text-spa-dark mix-blend-difference">
              {Math.round(waterPercentage)}%
            </span>
          </div>

          {/* Elegant Outline Add Water Button */}
          <button
            onClick={handleAddWater}
            aria-label="Registrar 250ml de água"
            className="group/btn flex items-center justify-center w-12 h-12 rounded-full border border-sand-200 hover:border-quartz-300 text-spa-dark hover:text-quartz-500 bg-white/40 hover:bg-white transition-all duration-500 active:scale-95 cursor-pointer shadow-sm"
          >
            <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-500 ease-out" />
          </button>
        </div>
      </div>
    </div>
  );
}
