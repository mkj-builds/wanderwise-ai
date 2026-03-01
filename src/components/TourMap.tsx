import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from 'react-simple-maps';
import { RoutePoint } from '../gemini';
import { geoMercator } from 'd3-geo';
import { Maximize2, X, Plane } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

interface TourMapProps {
  route: RoutePoint[];
  country: string;
}

export const TourMap: React.FC<TourMapProps> = ({ route, country }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const validRoute = useMemo(() => route.filter(p => typeof p.lng === 'number' && !isNaN(p.lng) && typeof p.lat === 'number' && !isNaN(p.lat)), [route]);

  const routeCenter = useMemo(() => {
    if (validRoute.length === 0) return [0, 0];
    const minLng = Math.min(...validRoute.map(p => p.lng));
    const maxLng = Math.max(...validRoute.map(p => p.lng));
    const minLat = Math.min(...validRoute.map(p => p.lat));
    const maxLat = Math.max(...validRoute.map(p => p.lat));
    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  }, [validRoute]);

  // Create a custom projection to perfectly fit the route
  const projection = useMemo(() => {
    if (validRoute.length === 0) return geoMercator();
    
    if (validRoute.length === 1) {
      return geoMercator()
        .center([validRoute[0].lng, validRoute[0].lat])
        .scale(4000)
        .translate([400, 200]);
    }

    const lineString = {
      type: "LineString",
      coordinates: validRoute.map(p => [p.lng, p.lat])
    };

    // fitExtent takes [[left, top], [right, bottom]]
    // We use an 800x400 canvas with 80px padding to zoom in perfectly
    return geoMercator().fitExtent([[80, 80], [720, 320]], lineString as any);
  }, [validRoute]);

  if (validRoute.length === 0) return null;

  const renderMapContent = () => {
    // Pre-calculate projected points and filter out invalid ones
    const projectedRoute = validRoute.map(point => {
      const projected = projection([point.lng, point.lat]);
      return { ...point, projected };
    }).filter(p => p.projected !== null);

    const placedLabels: {x: number, y: number, width: number, height: number}[] = [];

    // Reserve space for all markers to prevent text from overlapping them
    projectedRoute.forEach((point, i) => {
      const isStart = i === 0 || point.type === 'start';
      const isEnd = i === projectedRoute.length - 1 || point.type === 'end';
      const [x, y] = point.projected;
      placedLabels.push({ x, y, width: isStart || isEnd ? 20 : 14, height: isStart || isEnd ? 20 : 14 });
    });

    const renderedNames = new Set<string>();

    return (
      <>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#f0f4f8"
                stroke="#d1d5db"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "#e2e8f0" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {/* Draw solid curved lines between points */}
        {projectedRoute.map((point, i) => {
          if (i === projectedRoute.length - 1) return null;
          const nextPoint = projectedRoute[i + 1];
          
          const p1 = point.projected;
          const p2 = nextPoint.projected;
          
          if (!p1 || !p2) return null;
          
          const [x1, y1] = p1;
          const [x2, y2] = p2;
          
          // Calculate control point for a very slight curve towards the center of the route (inland)
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          
          const [cx_route, cy_route] = projection(routeCenter as [number, number]) || [400, 200];
          const toCenterX = cx_route - mx;
          const toCenterY = cy_route - my;
          
          const dotProduct = toCenterX * (-dy) + toCenterY * dx;
          const sign = dotProduct > 0 ? 1 : -1;
          
          // Very slight curve (0.05) to keep it mostly over land
          const cx = mx - dy * 0.05 * sign;
          const cy = my + dx * 0.05 * sign;

          // Calculate midpoint for the arrow
          const midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
          const midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
          
          // Tangent at t=0.5 is parallel to P2 - P0
          const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

          return (
            <g key={`route-segment-${i}`}>
              <path
                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                fill="transparent"
                stroke="#ef4444"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* Directional Arrow */}
              <polygon
                points="-3,-2 3,0 -3,2 -1,0"
                fill="#111827"
                transform={`translate(${midX}, ${midY}) rotate(${angle})`}
              />
            </g>
          );
        })}

        {/* Draw markers and labels */}
        {projectedRoute.map((point, i) => {
          const isStart = i === 0 || point.type === 'start';
          const isEnd = i === projectedRoute.length - 1 || point.type === 'end';
          
          const [x, y] = point.projected;
          
          const hasBeenRendered = renderedNames.has(point.name);
          if (!hasBeenRendered) {
            renderedNames.add(point.name);
          }

          const isAirport = /airport|intl|international|apt/i.test(point.name);
          
          // Split text into lines if it's an airport
          const words = point.name.split(' ');
          const lines = [];
          let currentLine = words[0] || '';
          for (let j = 1; j < words.length; j++) {
            if (currentLine.length + words[j].length + 1 <= 18) {
              currentLine += ' ' + words[j];
            } else {
              lines.push(currentLine);
              currentLine = words[j];
            }
          }
          if (currentLine) lines.push(currentLine);

          // Collision detection for labels
          let bestPos = { dx: 0, dy: -20, d: 20 };
          const angles = [ -Math.PI/2, Math.PI/2, 0, Math.PI, -Math.PI/4, Math.PI/4, -3*Math.PI/4, 3*Math.PI/4 ];
          const distances = [20, 30, 40, 50, 60, 70];
          let found = false;
          
          const fontSize = isAirport ? 9 : (isStart || isEnd ? 14 : 12);
          const charWidth = isAirport ? 5 : 7;
          const lineHeight = isAirport ? 11 : 16;
          
          const textWidth = Math.max(...lines.map(l => l.length)) * charWidth + (isAirport ? 16 : 0);
          const textHeight = (isStart ? 16 : 0) + (lines.length * lineHeight);
          const textCenterYOffset = isStart ? 11 : 4;

          if (!hasBeenRendered) {
            for (const d of distances) {
              for (const a of angles) {
                 const lx = x + Math.cos(a) * d;
                 const ly = y + Math.sin(a) * d;
                 const textCenterY = ly + textCenterYOffset;
                 
                 // Check collision
                 const collision = placedLabels.some(l => {
                   return Math.abs(l.x - lx) < (l.width + textWidth)/2 + 4 && 
                          Math.abs(l.y - textCenterY) < (l.height + textHeight)/2 + 4;
                 });
                 
                 if (!collision) {
                    bestPos = { dx: Math.cos(a) * d, dy: Math.sin(a) * d, d };
                    found = true;
                    break;
                 }
              }
              if (found) break;
            }
            placedLabels.push({ x: x + bestPos.dx, y: y + bestPos.dy + textCenterYOffset, width: textWidth, height: textHeight });
          }

          return (
            <g key={`marker-${i}`}>
              <circle 
                cx={x} cy={y}
                r={isStart || isEnd ? 8 : 5} 
                fill={isStart || isEnd ? "#312e81" : "#111827"} 
                stroke="#ffffff"
                strokeWidth={2}
              />
              
              {!hasBeenRendered && (
                <>
                  {/* Pointer line if label is moved far */}
                  {bestPos.d > 22 && (
                    <line 
                      x1={x} y1={y} 
                      x2={x + bestPos.dx} y2={y + bestPos.dy} 
                      stroke="#9ca3af" 
                      strokeWidth={1.5} 
                      strokeDasharray="2,2" 
                    />
                  )}
                  
                  <g transform={`translate(${x + bestPos.dx}, ${y + bestPos.dy + 4})`}>
                    {isAirport && (
                      <g transform={`translate(${-textWidth/2}, -9)`}>
                        <Plane size={10} color="#111827" fill="#111827" />
                      </g>
                    )}
                    {lines.map((line, lineIdx) => (
                      <text
                        key={lineIdx}
                        textAnchor="middle"
                        y={lineIdx * lineHeight}
                        x={isAirport ? 6 : 0}
                        style={{ 
                          fontFamily: isAirport ? "Inter, sans-serif" : "'Playfair Display', serif", 
                          fontSize: `${isAirport ? fontSize : fontSize + 1}px`,
                          fontWeight: isAirport ? "600" : (isStart || isEnd ? "700" : "500"),
                          fontStyle: isAirport ? "normal" : "italic",
                          fill: isAirport ? "#111827" : "#374151",
                          textShadow: "1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0px 2px 4px rgba(0,0,0,0.15)"
                        }}
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                  
                  {isStart && (
                    <text
                      x={x + bestPos.dx}
                      y={y + bestPos.dy + (lines.length * lineHeight) + 4}
                      textAnchor="middle"
                      style={{ 
                        fontFamily: "Inter, sans-serif", 
                        fontSize: "9px",
                        fontWeight: "900",
                        fill: "#ef4444",
                        letterSpacing: "2px",
                        textShadow: "2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff"
                      }}
                    >
                      START
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </>
    );
  };

  return (
    <>
      {/* Inline Map */}
      <div 
        className="bg-white rounded-2xl border border-luxury-100 p-2 shadow-sm relative h-[400px] flex items-center justify-center group cursor-pointer overflow-hidden"
        onClick={() => setIsExpanded(true)}
      >
        <div className="absolute top-6 left-6 z-10 pointer-events-none">
          <h3 className="text-sm font-bold text-deep-navy uppercase tracking-widest">{country} Tour Route</h3>
        </div>
        
        <div className="absolute top-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-2 rounded-full shadow-sm">
          <Maximize2 size={18} className="text-deep-navy" />
        </div>
        
        <ComposableMap
          projection={projection as any}
          width={800}
          height={400}
          style={{ width: "100%", height: "100%" }}
        >
          {renderMapContent()}
        </ComposableMap>
      </div>

      {/* Expanded Modal Map */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-deep-navy/90 backdrop-blur-sm p-4 md:p-12"
              onClick={() => setIsExpanded(false)}
            >
              <motion.div 
                initial={{ scale: 0.2, x: "40vw", opacity: 0 }}
                animate={{ scale: 1, x: 0, opacity: 1 }}
                exit={{ scale: 0.2, x: "40vw", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white rounded-3xl w-[95vw] h-[95vh] max-w-none relative overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-6 left-8 z-10">
                  <h3 className="text-xl font-bold text-deep-navy uppercase tracking-widest">{country} Tour Route</h3>
                </div>
                
                <button 
                  className="absolute top-6 right-8 z-10 bg-luxury-100 hover:bg-luxury-200 p-3 rounded-full transition-colors"
                  onClick={() => setIsExpanded(false)}
                >
                  <X size={24} className="text-deep-navy" />
                </button>

                <div className="flex-1 w-full h-full p-4 flex items-center justify-center overflow-hidden bg-luxury-50/30 rounded-b-3xl">
                  <ComposableMap
                    projection={projection as any}
                    width={800}
                    height={400}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <ZoomableGroup center={routeCenter as [number, number]} zoom={1} maxZoom={10}>
                      {renderMapContent()}
                    </ZoomableGroup>
                  </ComposableMap>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
