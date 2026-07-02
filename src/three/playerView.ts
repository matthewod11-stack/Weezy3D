import * as THREE from "three";
import { RENDER_SCALE } from "../config/game";
import { toWorldLen, toWorldX, toWorldY } from "./coords";
import { type Frame, loadFrame, measureBottomMargin } from "./billboard";
import type { PhysRect, PlayerState } from "./physics3d";

import eloiseIdleUrl from "../../assets/sprites/player/storybook/eloise_idle.png?url";
import eloiseJumpUrl from "../../assets/sprites/player/storybook/eloise_jump.png?url";
import eloiseWalk0Url from "../../assets/sprites/player/storybook/eloise_walk_0.png?url";
import eloiseWalk1Url from "../../assets/sprites/player/storybook/eloise_walk_1.png?url";
import eloiseWalk2Url from "../../assets/sprites/player/storybook/eloise_walk_2.png?url";
import eloiseWalk3Url from "../../assets/sprites/player/storybook/eloise_walk_3.png?url";
import eloiseWalk4Url from "../../assets/sprites/player/storybook/eloise_walk_4.png?url";
import eloiseWalk5Url from "../../assets/sprites/player/storybook/eloise_walk_5.png?url";

/** Same on-screen size as the 2D game: storybook PNGs scaled by 0.06×S. */
const AVATAR_SCALE = 0.06 * RENDER_SCALE;
const WALK_FPS = 10;
const WALK_VX_THRESHOLD = 8 * RENDER_SCALE;
/** Diorama convention: solids' front faces sit at z = 0 (see level3d.ts);
 *  the billboard floats just in front so platforms never occlude her. */
const PLAYER_Z = 0.06;
/** The blob sits back on the surface so it doesn't overhang platform fronts. */
const SHADOW_Z = -0.3;

const WALK_URLS = [
  eloiseWalk0Url,
  eloiseWalk1Url,
  eloiseWalk2Url,
  eloiseWalk3Url,
  eloiseWalk4Url,
  eloiseWalk5Url,
];

// ---------------------------------------------------------------------------
// Pure pose math — node-testable, no THREE object state. Everything below is
// deterministic: driven only by PlayerState + clocks accumulated from dtMs
// (never Date.now), so poses re-derive identically each frame (gotcha 12:
// views never latch visual state).
// ---------------------------------------------------------------------------

/** Squash & stretch impulse: eases from (fromX, fromY) back to (1, 1). */
export interface SquashTween {
  /** Starting scale magnitudes (sign-free; facing is applied separately). */
  fromX: number;
  fromY: number;
  /** Counts down by dtMs; the tween ends at 0. */
  remainingMs: number;
  durationMs: number;
}

export const SQUASH_LAND = { x: 1.18, y: 0.82, durationMs: 130 } as const;
export const SQUASH_JUMP = { x: 0.88, y: 1.14, durationMs: 150 } as const;
export const SQUASH_AIR_JUMP = { x: 0.8, y: 1.22, durationMs: 180 } as const;

export const FLIP_DURATION_MS = 80;
export const FLIP_MIN_SCALE = 0.5;

/** Dash lean/stretch eases out over the final ms of the dash window. */
export const DASH_EASE_MS = 120;
export const DASH_LEAN_RAD = 0.15;
export const DASH_SCALE = { x: 1.2, y: 0.9 } as const;

export const GLIDE_SWAY_HZ = 1.2;
export const GLIDE_SWAY_RAD = 0.06;
export const GLIDE_SCALE = { x: 1.05, y: 0.95 } as const;

export const CLIMB_LEAN_RAD = 0.12;
export const CLIMB_BOB_HZ = 2;
/** World units (1 unit ≈ one Eloise body height) — a tiny shimmy. */
export const CLIMB_BOB_AMP = 0.03;

export const IDLE_BREATH_HZ = 0.9;
export const IDLE_BREATH_Y = 0.015;
export const IDLE_BREATH_X = 0.008;

export const INVINCIBLE_PULSE_HZ = 8;
export const INVINCIBLE_MIN_OPACITY = 0.45;
export const INVINCIBLE_TINT_MS = 200;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Ease-out cubic: fast start, gentle settle. */
export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - (1 - c) ** 3;
}

/**
 * Advance the squash tween one frame. One-frame flags are consumed the frame
 * they're true and REPLACE any running tween (strongest source wins when
 * several fire together — an air-jump also sets justJumped in the sim).
 */
export function stepSquashTween(
  prev: SquashTween | null,
  flags: { justLanded: boolean; justJumped: boolean; justAirJumped: boolean },
  dtMs: number,
): SquashTween | null {
  const spawn = flags.justAirJumped
    ? SQUASH_AIR_JUMP
    : flags.justJumped
      ? SQUASH_JUMP
      : flags.justLanded
        ? SQUASH_LAND
        : null;
  if (spawn) {
    return { fromX: spawn.x, fromY: spawn.y, remainingMs: spawn.durationMs, durationMs: spawn.durationMs };
  }
  if (!prev) return null;
  const remainingMs = prev.remainingMs - dtMs;
  return remainingMs > 0 ? { ...prev, remainingMs } : null;
}

/** Current scale magnitudes of a squash tween ((1,1) when none is running). */
export function squashScaleAt(tween: SquashTween | null): { x: number; y: number } {
  if (!tween) return { x: 1, y: 1 };
  const t = easeOutCubic(1 - tween.remainingMs / tween.durationMs);
  return {
    x: tween.fromX + (1 - tween.fromX) * t,
    y: tween.fromY + (1 - tween.fromY) * t,
  };
}

/**
 * Signed scale.x multiplier for the turn-around flip. First half shrinks at
 * the OLD facing (1 → FLIP_MIN_SCALE), second half grows at the NEW facing
 * (FLIP_MIN_SCALE → 1) — |scale.x| dips to ~0.5 mid-flip instead of snapping.
 */
export function flipScaleX(progress: number, fromFacing: 1 | -1, toFacing: 1 | -1): number {
  const p = clamp01(progress);
  if (p < 0.5) return fromFacing * (1 - (1 - FLIP_MIN_SCALE) * (p * 2));
  return toFacing * (FLIP_MIN_SCALE + (1 - FLIP_MIN_SCALE) * ((p - 0.5) * 2));
}

/** Which mutually-exclusive state pose is active (priority order). */
export type StatePoseKind = "dash" | "glide" | "climb" | "idle" | "none";

export function statePoseKind(i: {
  dashMsRemaining: number;
  gliding: boolean;
  climbing: boolean;
  onGround: boolean;
  vxAbs: number;
  walkThreshold: number;
}): StatePoseKind {
  if (i.dashMsRemaining > 0) return "dash";
  if (i.gliding) return "glide";
  if (i.climbing) return "climb";
  if (i.onGround && i.vxAbs <= i.walkThreshold) return "idle";
  return "none";
}

/** Continuous state-driven pose. `clockMs` accumulates from dtMs while the
 *  kind is active (reset on entry) so sways/bobs are deterministic. */
export interface Pose {
  /** Scale magnitudes (facing sign applied by the flip layer). */
  scaleX: number;
  scaleY: number;
  rotZ: number;
  /** Additive world-unit y offset (climb shimmy). */
  bobY: number;
}

export const IDENTITY_POSE: Pose = { scaleX: 1, scaleY: 1, rotZ: 0, bobY: 0 };

export function statePose(
  kind: StatePoseKind,
  i: {
    facing: 1 | -1;
    dashMsRemaining: number;
    clockMs: number;
    /** Idle breathing yields to event tweens (tweens take priority). */
    tweenActive: boolean;
  },
): Pose {
  switch (kind) {
    case "dash": {
      const k = clamp01(i.dashMsRemaining / DASH_EASE_MS);
      return {
        scaleX: 1 + (DASH_SCALE.x - 1) * k,
        scaleY: 1 + (DASH_SCALE.y - 1) * k,
        rotZ: -i.facing * DASH_LEAN_RAD * k,
        bobY: 0,
      };
    }
    case "glide": {
      const sway = Math.sin((i.clockMs / 1000) * GLIDE_SWAY_HZ * 2 * Math.PI) * GLIDE_SWAY_RAD;
      return { scaleX: GLIDE_SCALE.x, scaleY: GLIDE_SCALE.y, rotZ: sway, bobY: 0 };
    }
    case "climb": {
      const bob = Math.sin((i.clockMs / 1000) * CLIMB_BOB_HZ * 2 * Math.PI) * CLIMB_BOB_AMP;
      // Lean INTO the wall — she faces it, so the lean follows facing.
      return { scaleX: 1, scaleY: 1, rotZ: i.facing * CLIMB_LEAN_RAD, bobY: bob };
    }
    case "idle": {
      if (i.tweenActive) return IDENTITY_POSE;
      const s = Math.sin((i.clockMs / 1000) * IDLE_BREATH_HZ * 2 * Math.PI);
      return { scaleX: 1 - s * IDLE_BREATH_X, scaleY: 1 + s * IDLE_BREATH_Y, rotZ: 0, bobY: 0 };
    }
    case "none":
      return IDENTITY_POSE;
  }
}

/**
 * Hurt/invincibility look, re-derived from (active, elapsedMs) every frame.
 * Inactive ALWAYS returns the fully-restored values (opacity 1, white tint) —
 * callers apply the result unconditionally, so nothing latches (gotcha 12).
 */
export function invincibilityVisual(active: boolean, elapsedMs: number): { opacity: number; tint: number } {
  if (!active) return { opacity: 1, tint: 0xffffff };
  const mid = (1 + INVINCIBLE_MIN_OPACITY) / 2;
  const amp = (1 - INVINCIBLE_MIN_OPACITY) / 2;
  const opacity = mid + amp * Math.sin((elapsedMs / 1000) * INVINCIBLE_PULSE_HZ * 2 * Math.PI);
  // Tint toward 0xff9999 for the first INVINCIBLE_TINT_MS, fading back to white.
  const k = Math.max(0, 1 - elapsedMs / INVINCIBLE_TINT_MS);
  const gb = Math.round(0xff - (0xff - 0x99) * k);
  const tint = 0xff0000 | (gb << 8) | gb;
  return { opacity, tint };
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/**
 * Eloise as a camera-facing storybook billboard (HD-2D, Option A from the
 * transition guide) + a soft ground-cast shadow blob that doubles as the
 * landing-point affordance for kids.
 *
 * A transform-only "juice" layer rides on top of the base billboard:
 * squash & stretch on jump/air-jump/land, dash lean, glide sway, climb lean,
 * idle breathing, turn-around flip, and an invincibility pulse. Composition
 * per frame: base texture → state pose (dash > glide > climb > idle-breath,
 * mutually exclusive) → event tween (multiplies) → flip on scale.x sign.
 * All of it re-derives from PlayerState + dtMs-accumulated clocks.
 */
export class PlayerView {
  readonly group: THREE.Group;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly shadow: THREE.Mesh;

  private readonly idle: Frame;
  private readonly jump: Frame;
  private readonly walk: Frame[];

  /** World-unit plane size + feet anchor offset, from the idle frame. */
  private readonly planeW: number;
  private readonly planeH: number;
  private readonly feetOffset: number;

  private walkClockMs = 0;
  private currentTexture: THREE.Texture | null = null;

  // Juice-layer internals — clocks/timers only; poses re-derive every frame.
  private squash: SquashTween | null = null;
  private stateKind: StatePoseKind = "none";
  private stateClockMs = 0;
  private lastFacing: 1 | -1 = 1;
  private flipFromFacing: 1 | -1 = 1;
  private flipRemainingMs = 0;

  private constructor(idle: Frame, jump: Frame, walk: Frame[]) {
    this.idle = idle;
    this.jump = jump;
    this.walk = walk;

    const imgW = idle.image.width;
    const imgH = idle.image.height;
    // Source px → render px (AVATAR_SCALE) → world units.
    this.planeW = toWorldLen(imgW * AVATAR_SCALE);
    this.planeH = toWorldLen(imgH * AVATAR_SCALE);

    // Feet origin across all frames — most-trimmed frame wins (see
    // computeFeetOriginY): others may press slightly into the floor, which
    // reads better than floating.
    let minRatio = 1;
    for (const f of [idle, jump, ...walk]) {
      const margin = measureBottomMargin(f.image);
      const ratio = (f.image.height - margin) / f.image.height;
      if (ratio < minRatio) minRatio = ratio;
    }
    // Plane center sits feetOffset above the physics feet position.
    this.feetOffset = this.planeH * (minRatio - 0.5);

    this.material = new THREE.MeshBasicMaterial({
      map: idle.texture,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.planeW, this.planeH), this.material);
    this.mesh.renderOrder = 10;
    this.currentTexture = idle.texture;

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x4a3728,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(1, 0.78, 1);
    this.shadow.renderOrder = 5;

    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.group.add(this.shadow);
  }

  static async load(): Promise<PlayerView> {
    const [idle, jump, ...walk] = await Promise.all([
      loadFrame(eloiseIdleUrl),
      loadFrame(eloiseJumpUrl),
      ...WALK_URLS.map(loadFrame),
    ]);
    return new PlayerView(idle, jump, walk);
  }

  /**
   * Sync the billboard with the simulation. `solids` lets the shadow blob
   * ground-cast: it sits on the highest surface below the player's feet.
   */
  update(state: PlayerState, deltaMs: number, solids: readonly PhysRect[]): void {
    const wx = toWorldX(state.x);
    const feetY = toWorldY(state.y);

    const climbing = state.climbing;
    const gliding = state.gliding;

    // Frame selection — same rules as the 2D updateAvatarFrame, plus: climbing
    // freezes the walk-frame clock (no advance, no reset) and holds on the
    // airborne frame while she's on the wall.
    let texture: THREE.Texture;
    if (climbing) {
      texture = this.jump.texture;
    } else if (!state.onGround) {
      texture = this.jump.texture;
      this.walkClockMs = 0;
    } else if (Math.abs(state.vx) > WALK_VX_THRESHOLD) {
      this.walkClockMs += deltaMs;
      const idx = Math.floor((this.walkClockMs / 1000) * WALK_FPS) % this.walk.length;
      texture = this.walk[idx]!.texture;
    } else {
      texture = this.idle.texture;
      this.walkClockMs = 0;
    }
    if (texture !== this.currentTexture) {
      this.material.map = texture;
      this.material.needsUpdate = true;
      this.currentTexture = texture;
    }

    // Event tween — one-frame flags consumed here; a new flag replaces any
    // running tween.
    this.squash = stepSquashTween(this.squash, state, deltaMs);
    const squash = squashScaleAt(this.squash);

    // State pose (mutually exclusive; dash > glide > climb > idle-breath).
    // Its clock resets on state entry and accumulates dtMs while active.
    const kind = statePoseKind({
      dashMsRemaining: state.dashMsRemaining,
      gliding,
      climbing,
      onGround: state.onGround,
      vxAbs: Math.abs(state.vx),
      walkThreshold: WALK_VX_THRESHOLD,
    });
    if (kind !== this.stateKind) {
      this.stateKind = kind;
      this.stateClockMs = 0;
    } else {
      this.stateClockMs += deltaMs;
    }
    const pose = statePose(kind, {
      facing: state.facing,
      dashMsRemaining: state.dashMsRemaining,
      clockMs: this.stateClockMs,
      tweenActive: this.squash !== null,
    });

    // Turn-around flip — animate scale.x through the sign change.
    if (state.facing !== this.lastFacing) {
      this.flipFromFacing = this.lastFacing;
      this.lastFacing = state.facing;
      this.flipRemainingMs = FLIP_DURATION_MS;
    } else if (this.flipRemainingMs > 0) {
      this.flipRemainingMs = Math.max(0, this.flipRemainingMs - deltaMs);
    }
    const flipX =
      this.flipRemainingMs > 0
        ? flipScaleX(1 - this.flipRemainingMs / FLIP_DURATION_MS, this.flipFromFacing, state.facing)
        : state.facing;

    // Compose: state pose × event tween on the magnitudes, flip owns the sign.
    const scaleX = flipX * pose.scaleX * squash.x;
    const scaleY = pose.scaleY * squash.y;
    this.mesh.scale.set(scaleX, scaleY, 1);
    this.mesh.rotation.z = pose.rotZ;

    // Feet planting under squash: the plane's center sits feetOffset above the
    // feet, so the feet live at local y = −feetOffset. Scaling y from the
    // center moves them to −feetOffset·scaleY — compensate by positioning the
    // center at feetY + feetOffset·scaleY, keeping the feet pinned at feetY.
    this.mesh.position.set(wx, feetY + this.feetOffset * scaleY + pose.bobY, PLAYER_Z);

    // Ground-cast shadow: highest solid top at/below the feet. Never blinks,
    // never squashes — it's the landing affordance.
    const groundPxY = this.groundBelow(state, solids);
    const heightAbove = toWorldY(state.y) - toWorldY(groundPxY);
    const fade = Math.max(0.35, 1 - heightAbove / 3.2);
    this.shadow.position.set(wx, toWorldY(groundPxY) + 0.012, SHADOW_Z);
    this.shadow.scale.set(fade, fade * 0.78, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 * fade;
  }

  /**
   * Hurt/invincibility look — call EVERY frame with the current state. While
   * active the sprite pulses opacity 1↔0.45 (~8 Hz) and tints toward 0xff9999
   * for the first 200 ms. While inactive it re-asserts full opacity + white
   * tint each call (gotcha 12: restore, don't latch). The shadow blob is
   * deliberately untouched — only the sprite mesh blinks.
   */
  setInvincible(active: boolean, elapsedMs: number): void {
    const v = invincibilityVisual(active, elapsedMs);
    this.material.opacity = v.opacity;
    this.material.color.setHex(v.tint);
  }

  /** Highest platform top at or below the player's feet, in px (y-down). */
  private groundBelow(state: PlayerState, solids: readonly PhysRect[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (const r of solids) {
      const overlapsX = state.x + 1 > r.x && state.x - 1 < r.x + r.w;
      if (!overlapsX) continue;
      if (r.y >= state.y - 0.5 && r.y < best) {
        best = r.y;
      }
    }
    return Number.isFinite(best) ? best : state.y + 400;
  }
}
