"use client";

export default function MykaPortrait({ className = "h-full w-full" }: { className?: string }) {
  return <svg viewBox="0 0 440 420" className={className} role="img" aria-label="Ilustração da gata MYKA">
      <defs>
        <linearGradient id="myka-fur" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a18bff"/><stop offset=".55" stopColor="#7652f8"/><stop offset="1" stopColor="#4c2dc1"/></linearGradient>
        <linearGradient id="myka-tail" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#8b69ff"/><stop offset="1" stopColor="#3e25a3"/></linearGradient>
      </defs>
      <ellipse cx="212" cy="392" rx="150" ry="18" fill="#9f7aff" opacity=".2"/>
      <path d="M300 320 C415 322 408 160 345 188 C322 201 335 228 354 223" fill="none" stroke="url(#myka-tail)" strokeWidth="39" strokeLinecap="round"/>
      <path d="M130 224 C111 264 102 322 126 365 C149 391 278 390 301 356 C319 321 301 259 273 225Z" fill="url(#myka-fur)" stroke="#3d279b" strokeWidth="5"/>
      <path d="M109 122 L94 35 Q91 19 108 27 L166 64 Q217 49 270 66 L330 25 Q346 20 343 41 L326 131 Q353 178 327 227 Q296 273 213 274 Q127 272 97 223 Q72 172 109 122Z" fill="url(#myka-fur)" stroke="#3d279b" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M116 57 L132 94 L157 73Z M308 55 L281 76 L311 99Z" fill="#d0b7ff" opacity=".75"/>
      <ellipse cx="162" cy="166" rx="46" ry="53" fill="#fff"/><ellipse cx="266" cy="166" rx="46" ry="53" fill="#fff"/>
      <ellipse cx="173" cy="173" rx="13" ry="30" fill="#21164c"/><ellipse cx="254" cy="173" rx="13" ry="30" fill="#21164c"/>
      <circle cx="180" cy="155" r="6" fill="#fff"/><circle cx="260" cy="155" r="6" fill="#fff"/>
      <path d="M207 215 Q214 208 221 215 L214 223Z" fill="#28164f"/><path d="M214 223 Q204 233 195 226 M214 223 Q225 233 234 226" fill="none" stroke="#28164f" strokeWidth="3" strokeLinecap="round"/>
      <path d="M157 310 Q145 348 151 376 M267 310 Q280 348 273 376" fill="none" stroke="#3d279b" strokeWidth="6" strokeLinecap="round"/>
      <ellipse cx="153" cy="370" rx="38" ry="18" fill="#7652f8"/><ellipse cx="271" cy="370" rx="38" ry="18" fill="#7652f8"/>
      <path d="M187 268 Q214 287 241 268" fill="none" stroke="#d7c6ff" strokeWidth="7" strokeLinecap="round"/>
      <circle cx="214" cy="288" r="17" fill="#f5c65c" stroke="#a87725" strokeWidth="4"/><path d="M214 283 V293" stroke="#7b511e" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="78" cy="172" r="4" fill="#c8b9ff"/><circle cx="369" cy="101" r="5" fill="#c8b9ff"/><path d="M65 87 v18 m-9 -9 h18 M366 290 v16 m-8 -8 h16" stroke="#c8b9ff" strokeWidth="3" strokeLinecap="round"/>
    </svg>;
}
