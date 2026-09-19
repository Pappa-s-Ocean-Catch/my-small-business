# Advanced TV Slideshow Animation Engine — Feature Requirements

A professional animation engine for a TV digital-signage app, supporting image-to-image transitions, animations during display, 3D effects, masks, shaders, and reusable presets. All effects should be configurable and suitable for unattended playback.

## 1. Basic image transitions

| Name | Description | Requirements |
|---|---|---|
| Fade | Fade current image out, then next in | Duration, easing |
| Cross Dissolve | Blend both images | Synchronized opacity |
| Slide Left / Right / Up / Down | Incoming image slides in | Direction, distance |
| Push | Incoming image pushes outgoing image | Both layers animated |
| Cover / Uncover | Move one layer over or away from the other | Layer order |
| Zoom In / Out | Scale incoming or outgoing image | Start/end scale, focal point |
| Rotate | Rotate image into position | Angle, pivot |
| Flip Horizontal / Vertical | Flip around X or Y axis | Perspective, backface visibility |
| Blur Transition | Blur old image, sharpen new image | Blur radius |
| Flash | Brief light flash between images | Colour, intensity, flash duration |

## 2. Cinematic animations during a slide

| Name | Description | Requirements |
|---|---|---|
| Ken Burns Zoom In / Out | Slow camera zoom | Start/end scale |
| Pan Left / Right / Up / Down | Slow camera translation | Distance, safe crop |
| Diagonal Pan | Move across both axes | Start/end positions |
| Zoom and Pan | Scale and translate together | Camera path |
| Focus Zoom | Zoom toward a selected subject | Normalized focal point |
| Slow Rotation | Gentle rotation | Angle, pivot, edge coverage |
| Floating Image | Slow multidirectional movement | Amplitude, period |
| Breathing Zoom | Subtle repeating zoom | Amplitude, frequency |
| Camera Drift | Subtle camera motion | Bounded drift |
| Parallax Pan | Foreground/background move at different speeds | Separate layers/depth metadata |
| Cinematic Reveal | Begin close and reveal full composition | Scale, position, easing |

Keep prices, labels, and important content visible. Automatically constrain camera paths to avoid exposed edges and unsafe cropping.

## 3. Advanced 3D transitions

| Name | Description | Requirements |
|---|---|---|
| 3D Cube / Cube Vertical | Rotate images on cube faces | Perspective, X/Y rotation |
| Page Flip / Book Turn | Turn image like a page | Pivot, perspective; curvature requires mesh/shader |
| Card Flip | Flip image to next | Backface visibility |
| Carousel | Rotate images around a carousel | Depth and perspective |
| Cylinder Rotate | Wrap transition around cylinder | Geometry/projection |
| Door Open / Close | Split into two door panels | Panel masks and synchronized transforms |
| Folding Screen / Accordion | Fold multiple strips | Strip count, perspective |
| 3D Swing / Tilt | Rotate image into depth | Transform origin |
| Depth Zoom / Fly Through | Simulate movement through depth | Z-depth and scale |
| Stack Cards / Falling Card | Layered card motion | Shadows, spring/gravity easing |
| Portal | Reveal through expanding portal | Mask and perspective |

Common parameters: perspective, rotateX/Y/Z, transform origin, shadow intensity, and backface visibility.

## 4. Mask and reveal transitions

| Name | Description | Requirements |
|---|---|---|
| Circle Reveal / Close | Expanding/shrinking circle | Radius and origin |
| Iris Reveal | Aperture-like reveal | Radial mask |
| Diamond / Star / Heart Reveal | Shape expands to show next image | SVG/shader mask |
| Rectangle Reveal | Expanding rectangle | Origin and bounds |
| Horizontal / Vertical / Diagonal Wipe | Moving reveal boundary | Direction/angle |
| Radial / Clock Wipe | Sweep around centre | Start angle, sweep direction |
| Spiral Reveal | Expanding spiral | Shader mask |
| Wave / Zigzag Reveal | Irregular moving edge | Amplitude/frequency or polygon |
| Split Horizontal / Vertical | Open or close two halves | Independent masks |
| Venetian / Vertical Blinds | Reveal in strips | Count, stagger |
| Checkerboard / Mosaic Reveal | Reveal tiles in sequence | Grid size, ordering |
| Random Tiles / Pixel Reveal | Reveal in randomized blocks | Seed, pixel size |
| Liquid / Brush Reveal | Organic reveal | Noise or animated brush mask |

Support origin: center, top, bottom, left, right, all four corners, and seeded random.

## 5. GPU and shader effects

| Name | Description | Requirements |
|---|---|---|
| Liquid Morph | Fluid distortion between images | UV displacement |
| Ripple / Water Drop | Expanding water distortion | Radial displacement/refraction |
| Wave Distortion | Traveling image wave | Sinusoidal displacement |
| Glitch / RGB Split | Digital interference | Channel offset, displacement |
| Pixel Sorting | Stylized pixel rearrangement | GPU approximation |
| Pixel Dissolve | Dissolve into blocks | Fragment mask |
| Particle Dissolve / Assemble | Image breaks apart or reforms | Particle system |
| Shatter | Break image into fragments | Geometry/instancing |
| Burn Away | Burn through image | Noise mask, glow |
| Smoke / Ink Spread | Organic reveal | Animated noise and alpha |
| Paint Splash | Reveal through splashes | Animated mask |
| Light Sweep / Lens Flare | Moving lighting | Intensity, direction |
| Chromatic Aberration | Split colour channels | RGB offsets |
| Motion / Radial / Zoom Blur | Directional blur during motion | Blur samples, radius |
| Kaleidoscope | Mirrored radial segments | Polar shader |
| Swirl / Vortex / Warp | Twist or distort image | UV transformation |
| Stretch / Elastic Morph | Stretch with rebound | Nonlinear displacement |
| Heat Haze | Hot-air distortion | Animated noise |
| Glass Refraction / Frosted Glass | Glass-like distortion | Refraction or blur |
| Film Burn / Film Grain | Analog film look | Light leak/noise |
| VHS / CRT Shutdown | Analog TV effects | Scanlines, collapse, glow |
| Digital Scan / Neon Edge | Scan or outline reveal | Scanline/edge detection |
| Energy Portal | Glowing portal transition | Radial mask, distortion, glow |

Some effects need geometry, particles, or multiple rendering passes—not only fragment shaders.

## 6. Reusable professional presets

| Preset | Sequence |
|---|---|
| Cinematic Zoom | Fade in → slow zoom → zoom blur exit |
| Luxury Showcase | Circle reveal → gentle pan → dissolve |
| Dynamic Promo | Slide in → focus zoom → diagonal wipe |
| Modern Digital | Glitch entry → drift → RGB split exit |
| Elegant Gallery | Soft fade → Ken Burns → soft fade |
| Action Promo | Fast zoom → camera movement → motion blur exit |
| Premium Food | Liquid reveal → slow zoom → light sweep exit |
| Product Spotlight | Dark reveal → focus zoom → fade |
| Floating Gallery | 3D card entry → floating → card flip |
| Retro Television | CRT power on → grain → shutdown |
| Digital Matrix | Pixel reveal → pan → pixel dissolve |
| Luxury Restaurant | Iris reveal → cinematic pan → soft blur |
| Modern Minimal | Mask reveal → subtle breathing → dissolve |
| Energetic Sale | Elastic zoom → floating → glitch exit |
| Smooth Carousel | Carousel entry → drift → carousel exit |

Presets must be editable, serializable, and reusable across playlists.

## 7. Smart morph transitions

For layered slides, match elements by stable IDs across consecutive slides. Interpolate position, size, scale, opacity, and rotation for matching elements. Animate removal and insertion for unmatched elements. Support images, text, and shapes. Example: retain the fish image while chips exit, salad enters, and the price changes. True object-level morphing is not reliable from two flattened JPEGs without segmentation or layered source assets.

## 8. TypeScript configuration contracts

```ts
type AnimationEasing =
  | 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'cubic-in' | 'cubic-out' | 'cubic-in-out'
  | 'quart-in' | 'quart-out' | 'expo-in' | 'expo-out'
  | 'back-in' | 'back-out' | 'elastic' | 'bounce' | 'spring';

type AnimationCategory =
  | 'basic' | 'cinematic' | '3d' | 'mask' | 'shader' | 'morph';

interface AnimationConfig {
  id: string;
  category: AnimationCategory;
  type: string;
  duration: number; // milliseconds
  delay?: number;
  easing?: AnimationEasing;
  direction?: 'left' | 'right' | 'up' | 'down' | 'center' | 'random';
  intensity?: number;
  scaleFrom?: number;
  scaleTo?: number;
  positionFrom?: { x: number; y: number };
  positionTo?: { x: number; y: number };
  rotation?: number;
  perspective?: number;
  parameters?: Record<string, unknown>;
}

interface SlideshowSlide {
  id: string;
  imageUrl: string;
  duration: number;
  animation?: AnimationConfig;
  effects?: AnimationConfig[];
}

interface SlideshowBoundary {
  fromSlideId: string;
  toSlideId: string;
  transition: AnimationConfig;
}
```

Use one transition on each slide boundary so the outgoing and incoming layers share the same clock.

## 9. TV-specific acceptance requirements

1. Target 1080p at 60 FPS and 4K at 30–60 FPS when hardware permits; adapt automatically.
2. Preload **and decode** the next image before starting a transition; provide a safe fallback if loading fails.
3. Keep outgoing and incoming images mounted throughout the shared transition; never flash black unintentionally.
4. Support `low`, `medium`, `high`, and `ultra` performance profiles; reduce shader complexity on weak TVs.
5. Support `fixed`, `random`, `sequence`, and `preset` selection; allow category filters and seeded randomness.
6. Support `contain`, `cover`, and `fill` fit modes; keep menu prices and product labels in safe areas.
7. Define timing semantics explicitly: display duration, incoming transition overlap, continuous animation interval, and outgoing overlap. Avoid double-counting shared transitions.
8. Expose duration, easing, direction, intensity, focal point, and relevant effect-specific parameters in UI.
9. Provide cancellation, pause/resume, playlist looping, screen resize/orientation handling, and recovery after app backgrounding.
10. Release GPU textures and animation resources when no longer needed; bound preloading and memory use.
11. Honor a reduced-motion mode and provide a simple fade fallback for unsupported effects.
12. Make effect registration modular: each effect declares its ID, category, parameter schema, supported renderer, and fallback.

## 10. Development phases

| Phase | Scope |
|---|---|
| 1 | Core timing, preloading, fades/slides, Ken Burns, pan/zoom, easing |
| 2 | Masks, tiles, blinds, splits, CSS 3D |
| 3 | GPU shaders, liquid/ripple/glitch, particle effects |
| 4 | Smart morph, cinematic presets, automatic animation selection |

## 11. Auto Cinematic Mode

Automatically select safe camera motion based on image composition. Examples: centred burger → slow focus zoom; food on right → pan toward right; multiple products → horizontal drift; text-heavy menu → static or subtle breathing; landscape → Ken Burns pan. Initial implementation can use aspect ratio, focal-point metadata, text-safe areas, and rules. Optional later computer vision can detect subjects and text and produce a camera path that preserves readability.

**Product priority:** Smooth playback, readable prices, reliable preloading, cinematic camera motion, and curated presets matter more than the raw number of effects.
