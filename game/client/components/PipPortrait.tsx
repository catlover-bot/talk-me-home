import { useId } from "react";

export type PipState =
  | "offline"
  | "ready"
  | "listening"
  | "considering"
  | "speaking"
  | "checking"
  | "paused"
  | "interrupted"
  | "success"
  | "error";

export const pipStateLabels: Record<PipState, string> = {
  offline: "Awaiting connection",
  ready: "Ready for your message",
  listening: "Listening",
  considering: "Considering your message",
  speaking: "Playing a response",
  checking: "Checking local equipment",
  paused: "Paused",
  interrupted: "Interrupted",
  success: "Arrival confirmed",
  error: "Connection unavailable",
};

/** Original character artwork. Its pose represents communication, never hidden room state. */
export function PipPortrait({
  state,
  compact = false,
}: {
  state: PipState;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const resting = state === "offline" || state === "paused";
  const surprised = state === "interrupted" || state === "error";
  const busy = state === "checking" || state === "considering";
  return (
    <figure
      className={`pip-portrait ${compact ? "pip-compact" : ""}`}
      data-state={state}
      aria-label={`Pip, UNIT 04. ${pipStateLabels[state]}.`}
    >
      <svg
        className="pip-art"
        viewBox="0 0 400 350"
        role="img"
        aria-labelledby={`${id}-title`}
      >
        <title id={`${id}-title`}>
          Pip, a small cream maintenance robot with an asymmetric antenna, a
          dark face, and a repaired orange shoulder patch.{" "}
          {pipStateLabels[state]}.
        </title>
        <defs>
          <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fff8e9" />
            <stop offset=".54" stopColor="#e9dfcd" />
            <stop offset="1" stopColor="#bdb19c" />
          </linearGradient>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#ddd3bf" />
            <stop offset="1" stopColor="#b8aa92" />
          </linearGradient>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#263b39" />
            <stop offset="1" stopColor="#142422" />
          </linearGradient>
          <clipPath id={`${id}-visor`}>
            <rect x="125" y="96" width="150" height="86" rx="29" />
          </clipPath>
        </defs>
        <ellipse
          cx="204"
          cy="323"
          rx="110"
          ry="13"
          fill="#0c1514"
          opacity=".32"
        />
        <path
          className="pip-orbit"
          d="M 68 218 C 23 128 77 50 136 31 M 288 55 C 352 83 371 145 350 196"
          fill="none"
          stroke="#737c6c"
          strokeWidth="1"
          opacity=".28"
        />
        <path
          d="M 57 226 v 7 m-3-3h6 M 343 47v7m-3-3h6"
          stroke="#9eaa95"
          strokeWidth="1.5"
          opacity=".48"
        />
        <g className="pip-body">
          <path
            d="M 154 282 L 149 314 Q 161 326 181 315 L 188 284"
            fill="#918671"
            stroke="#4b4d41"
            strokeWidth="3"
          />
          <path
            d="M 219 285 L 224 316 Q 245 327 256 314 L 249 279"
            fill="#918671"
            stroke="#4b4d41"
            strokeWidth="3"
          />
          <path
            d="M 143 308 Q 162 300 184 310 L 183 323 Q 158 331 140 321 Z"
            fill="#43534b"
            stroke="#293a34"
            strokeWidth="3"
          />
          <path
            d="M 223 309 Q 241 300 262 309 L 266 321 Q 245 332 222 324 Z"
            fill="#43534b"
            stroke="#293a34"
            strokeWidth="3"
          />
          <g className="pip-left-arm">
            <path
              d="M 140 212 Q 111 209 107 230 L 95 270 Q 90 287 107 292 Q 118 294 124 280 L 139 243"
              fill={`url(#${id}-body)`}
              stroke="#6b6c58"
              strokeWidth="3"
            />
            <path
              d="M 93 273 L 112 281 M 96 267 L 115 275"
              stroke="#596253"
              strokeWidth="4"
            />
            <path
              d="M 98 285 Q 84 293 88 306 M 103 291 Q 100 306 108 308 M 109 293 Q 113 304 119 300"
              fill="none"
              stroke="#3d4e43"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
          <g className="pip-right-arm">
            <path
              d="M 263 211 Q 288 206 294 229 L 306 267 Q 312 284 296 290 Q 281 294 276 278 L 262 244"
              fill={`url(#${id}-body)`}
              stroke="#6b6c58"
              strokeWidth="3"
            />
            <path
              d="M 286 279 L 306 271 M 284 273 L 303 265"
              stroke="#596253"
              strokeWidth="4"
            />
            <path
              d="M 299 288 Q 315 292 311 307 M 294 292 Q 299 307 291 310 M 288 291 Q 282 303 277 299"
              fill="none"
              stroke="#3d4e43"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
          <path
            d="M 151 195 Q 202 180 253 196 L 271 264 Q 270 294 249 301 H 155 Q 133 291 135 265 Z"
            fill={`url(#${id}-body)`}
            stroke="#586052"
            strokeWidth="3"
          />
          <path d="M 143 249 H 264 L 267 270 H 137 Z" fill="#3e5146" />
          <rect
            x="185"
            y="252"
            width="31"
            height="23"
            rx="4"
            fill="#b68c56"
            stroke="#273d30"
            strokeWidth="3"
          />
          <path
            d="M 162 217 H 232"
            stroke="#f5ebd8"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect x="154" y="229" width="27" height="10" rx="3" fill="#787f67" />
          <circle
            className="pip-chest-light"
            cx="244"
            cy="231"
            r="5"
            fill={
              state === "error"
                ? "#bc674b"
                : state === "success"
                  ? "#87a584"
                  : "#d3b071"
            }
          />
          <text
            x="201"
            y="290"
            textAnchor="middle"
            fill="#405047"
            fontFamily="ui-monospace, monospace"
            fontSize="11"
            letterSpacing="2"
          >
            UNIT 04
          </text>
          <path
            d="m 251 199 11 4-4 25-23-5 3-23Z"
            fill="#bd7353"
            stroke="#7e533f"
            strokeWidth="1.5"
          />
          <path
            d="m 240 205 15 3m-16 4 14 3m-16 4 14 3"
            stroke="#e5b38b"
            strokeWidth="1.5"
          />
        </g>
        <g className="pip-head">
          <path
            d="M 218 66 L 229 39 253 32"
            stroke="#9c9b7f"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M 218 65 L 229 39 253 32"
            stroke="#e7dcbf"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="257"
            cy="31"
            r="8"
            fill="#c58958"
            stroke="#554e38"
            strokeWidth="3"
          />
          <path
            d="M 111 113 L 99 118 V 157 L 112 164 M 287 111 L 300 119 V 157 L 287 163"
            fill="#8a9478"
            stroke="#465546"
            strokeWidth="3"
          />
          <path
            d="M 127 69 Q 195 52 266 68 Q 286 74 290 96 L 293 171 Q 291 192 268 200 Q 201 217 131 202 Q 108 195 108 173 L 110 101 Q 112 78 127 69Z"
            fill={`url(#${id}-shell)`}
            stroke="#6b735e"
            strokeWidth="3"
          />
          <path
            d="M 134 75 Q 195 61 258 74"
            stroke="#fffaf0"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".86"
          />
          <rect x="122" y="92" width="155" height="91" rx="30" fill="#455145" />
          <rect
            x="125"
            y="96"
            width="150"
            height="86"
            rx="29"
            fill={`url(#${id}-face)`}
          />
          <g clipPath={`url(#${id}-visor)`}>
            <path
              d="m 129 96 145 29v12L 125 107Z"
              fill="#a1b6a1"
              opacity=".07"
            />
          </g>
          <g
            className="pip-eyes"
            fill="#e5dba8"
            stroke="#e5dba8"
            strokeWidth="5"
            strokeLinecap="round"
          >
            {state === "success" ? (
              <>
                <path
                  d="M 148 130 Q 161 113 174 130 M 224 130 Q 237 113 250 130"
                  fill="none"
                />
              </>
            ) : resting ? (
              <>
                <path d="M 148 137 H 172 M 226 137 H 250" opacity=".54" />
              </>
            ) : state === "error" ? (
              <>
                <path d="m 148 132 24 8m54 0 24-8" />
                <path d="M 185 165 H 213" fill="none" strokeWidth="3" />
              </>
            ) : (
              <>
                <rect
                  x="148"
                  y={busy ? 126 : 117}
                  width="24"
                  height={busy ? 24 : surprised ? 33 : 35}
                  rx={busy ? 8 : 11}
                  stroke="none"
                />
                <rect
                  x="227"
                  y={state === "considering" ? 132 : busy ? 126 : 117}
                  width="24"
                  height={
                    state === "considering"
                      ? 17
                      : busy
                        ? 24
                        : surprised
                          ? 33
                          : 35
                  }
                  rx={busy ? 7 : 11}
                  stroke="none"
                />
              </>
            )}
          </g>
          {state !== "error" && (
            <path
              className="pip-mouth"
              d={
                state === "success" || state === "speaking"
                  ? "M 184 161 Q 199 173 215 161"
                  : surprised
                    ? "M 195 166 Q 200 158 205 166"
                    : "M 188 165 H 211"
              }
              fill="none"
              stroke="#cccd9e"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
          {(state === "considering" || state === "interrupted") && (
            <path
              d="m 145 107 28-4m52 1 28 5"
              fill="none"
              stroke="#ccc69b"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
          <circle cx="136" cy="191" r="3" fill="#8b947b" />
          <circle cx="264" cy="189" r="3" fill="#8b947b" />
          <path
            d="M 155 193 H 180 M 221 193 H 245"
            stroke="#afa58e"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        {state === "listening" && (
          <g
            className="pip-listening"
            fill="none"
            stroke="#b8bc97"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M 318 114 Q 331 132 318 150 M 330 105 Q 350 132 330 159" />
          </g>
        )}
        {busy && (
          <g className="pip-thought" fill="#c8b58b">
            <circle cx="317" cy="78" r="4" />
            <circle cx="331" cy="69" r="5" />
            <circle cx="348" cy="66" r="6" />
          </g>
        )}
        {state === "paused" && (
          <g fill="#b8baa4">
            <rect x="317" y="88" width="7" height="24" rx="2" />
            <rect x="330" y="88" width="7" height="24" rx="2" />
          </g>
        )}
        {state === "error" && (
          <g stroke="#dc9572" strokeWidth="3" strokeLinecap="round">
            <path d="m 320 87 14 14m-14 0 14-14" />
          </g>
        )}
        {state === "success" && (
          <g
            className="pip-celebration"
            fill="none"
            stroke="#c5be8c"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="m 80 99 9 10m-21 5 14 3m236-32 7-11m7 23 13-4" />
            <path d="m 312 182 5 9 10 2-9 5-2 10-5-9-10-2 9-5Z" />
          </g>
        )}
      </svg>
      <figcaption>
        <span className="pip-name">
          Pip <span>UNIT 04</span>
        </span>
        <span className="pip-state-label">{pipStateLabels[state]}</span>
      </figcaption>
    </figure>
  );
}
