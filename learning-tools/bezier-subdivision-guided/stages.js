// =============================================================================
// stages.js — The content of the guided activity: every step's text,
// questions, answers, and hints. There are no typed answers: every step is
// reading, clicking, or choosing. index.js is the engine that shows
// these steps and checks the answers; it contains no activity text.
//
// THE CURVE
// ---------
// Everyone works on the same cubic, so the hints can refer to it. The
// coordinates are "world" units in a WORLD_WIDTH × WORLD_HEIGHT box, with
// the origin at the top-left and y growing downward (as on a canvas).
// index.js scales this box to fit the window.
//
// The curve is deliberately lopsided: at t = 1/2 the two pieces have
// lengths of about 276 and 410, which the equal-length question relies on.
//
// STEP FORMAT
// -----------
// Every step has:
//   stage   which of the activity's stages it belongs to (shown in the panel)
//   title   a short heading
//   type    one of the types below
//   text    HTML shown at the top of the step
//   view    (optional) what the canvas shows; see VIEW FLAGS in index.js
//
// Types and their extra fields:
//   info      nothing extra: read, then Next.
//   choose-t  a t slider and a "Cut here" button. Any t is allowed; the
//             student moves on once they choose 1/2. notHalf / isHalf are
//             the feedback for the two cases ({t} is replaced by the value).
//   mc        multiple choice. id (for the review list), question,
//             options [{ text, correct, why }], viewAfter (view flags
//             added once the right answer is chosen).
//   place     click on the canvas to place the named construction points
//             (targets). hint is shown after two missed clicks. With
//             ordered: true, a point can only be placed after the two points
//             it comes from; with autoConnect: true, segments between
//             neighboring points are drawn automatically.
//   connect   click two points to draw a segment; segments lists the
//             segments that must be drawn.
//   pick      click the control points of one piece (name: 'L', 'R', 'QL',
//             or 'QR') in order. answer is the correct list; hints are shown
//             one more per wrong attempt.
//   choose-half  the student picks L or R to cut again; that piece is
//             called Q, and its points are named Q0..Q3, Q01, and so on.
//   flatness  judge one piece against its chord: the distances d1 and d2,
//             the tolerance band, the convex hull. Buttons move through the
//             tree of pieces; tolerance is the starting tolerance.
//   explore-stop  try three stopping rules (rules: settings for each).
//   trace     step through the recursive calls, with the flatness rule at
//             tolerance (world units). The first `predictions` line
//             segments must be predicted by clicking on the canvas.
//   parsons   put shuffled lines in order. Lines with the same group may
//             be in any order among themselves. done is shown when solved.
//   end       the summary and the review list.
//
// POINT NAMES
// -----------
// P0..P3 are the control points. A construction point is named after the
// control points it comes from: P01 is on segment P0P1, P012 is on segment
// P01P12, and P0123 is the last point. Together they form the de Casteljau
// triangle:
//
//   P0     P1     P2     P3
//      P01    P12    P23
//         P012   P123
//            P0123
// =============================================================================

const WORLD_WIDTH = 640;
const WORLD_HEIGHT = 400;

const CONTROL_POINTS = [
  { x: 70, y: 340 },   // P0
  { x: 120, y: 90 },   // P1
  { x: 260, y: 50 },   // P2
  { x: 580, y: 320 },  // P3
];

// Key used to save the review list in this browser.
const REVIEW_KEY = 'bezierSubdivisionReview';

const STEPS = [

  // ---------------------------------------------------------------------------
  // Stage 1. Choose where to cut.
  // ---------------------------------------------------------------------------
  {
    stage: 1,
    title: 'The problem',
    type: 'info',
    text: `
      <p>A screen can only draw straight line segments. How can we draw this
      cubic Bézier curve using only straight lines?</p>
      <p><strong>Idea:</strong> cut the curve into smaller curves. If we keep
      cutting, each piece eventually becomes so nearly straight that a single
      line segment is a good enough stand-in for it.</p>
      <p>A useful fact: when you cut a Bézier curve at any parameter value
      t, each of the two pieces is itself a Bézier curve of the same degree.
      In this activity you will find the control points of the two
      pieces.</p>`,
  },

  {
    stage: 1,
    title: 'Choose where to cut',
    type: 'choose-t',
    text: `
      <p>We can cut the curve at <strong>any</strong> value of t between 0
      and 1. Every choice works: the curve is split at the point B(t) into
      two pieces, shown in two colors.</p>
      <p>We will cut the pieces again, and then cut those pieces, many
      times. Move the slider and choose the value of t you think is the best
      choice for doing that.</p>`,
    notHalf: `
      <p>Cutting at t = {t} works: any t between 0 and 1 splits the curve
      into two Bézier curves.</p>
      <p>But look at the two pieces. One covers the parameter range from 0
      to {t}, and the other the range from {t} to 1, so they are not treated
      the same. Since we will repeat the cut many times, is there a value
      that treats both pieces the same and makes each construction as simple
      as possible? Try another value.</p>`,
    isHalf: `
      <p>t = ½ is the usual choice. Remember that it is a <em>choice</em>:
      other values of t would also work.</p>`,
    view: { splitAtT: true },
  },

  {
    stage: 1,
    title: 'Equal lengths?',
    type: 'mc',
    id: 'equal-length',
    text: `<p>Predict first, then look at the picture.</p>`,
    question: 'Does cutting at t = ½ cut the curve into two pieces of equal length?',
    options: [
      {
        text: 'Yes, always. t = ½ is halfway along the curve.',
        correct: false,
        why: 't measures progress in the parameter, not distance along the curve. The point B(t) moves faster in some places than in others.',
      },
      {
        text: 'No, not in general. The two pieces can have different lengths.',
        correct: true,
        why: 'Right. B(t) does not move at a constant speed as t increases, so equal steps in t can cover unequal distances. The picture now shows the two lengths for this curve.',
      },
      {
        text: 'Only when the curve is a quadratic.',
        correct: false,
        why: 'The pieces of a quadratic curve generally have different lengths too. The lengths are equal only in special cases, such as a symmetric control polygon.',
      },
      {
        text: 'Yes, because the new points will be midpoints.',
        correct: false,
        why: 'The new points are midpoints of the control-polygon segments, but those segments are not the curve. They tell us nothing directly about the curve\'s length.',
      },
    ],
    view: { splitAtT: true },
    viewAfter: { lengths: true, tTicks: true, halfLength: true },
  },

  {
    stage: 1,
    title: 'Look closer',
    type: 'info',
    text: `
      <p>The red tick marks show B(t) at t = 0, 0.1, 0.2, …, 1. They are
      <strong>not</strong> evenly spaced: B(t) moves faster where the
      control points are farther apart.</p>
      <p>The labels give the length of each piece. The hollow diamond marks
      the point halfway along the curve <em>by length</em>. Compare it with
      the cut point B(½).</p>
      <p><strong>Try it:</strong> drag the control points. Can you make the
      two lengths equal? (Hint: try a control polygon that is symmetric.)
      The curve goes back to its original shape when you click Next.</p>`,
    view: { splitAtT: true, lengths: true, tTicks: true, halfLength: true, draggable: true },
  },

  // ---------------------------------------------------------------------------
  // Stage 2. Cut the control polygon at its midpoints.
  // ---------------------------------------------------------------------------
  {
    stage: 2,
    title: 'Where to cut a segment',
    type: 'mc',
    id: 'cut-segment',
    text: `
      <p>We know where the curve is cut (at B(½)), but we need the control
      points of the two pieces. De Casteljau's algorithm finds them by
      cutting each segment of the control polygon at the same t.</p>`,
    question: 'With t = ½, where is segment P0P1 cut?',
    options: [
      {
        text: 'At its midpoint.',
        correct: true,
        why: 'Yes. The point a fraction ½ of the way from P0 to P1 is the midpoint of the segment.',
      },
      {
        text: 'At the point of the segment closest to the curve.',
        correct: false,
        why: 'The cut depends only on the segment\'s two endpoints and on t, not on where the curve is.',
      },
      {
        text: 'Where the segment passes through B(½).',
        correct: false,
        why: 'Segment P0P1 usually does not pass through B(½) at all. The cut point is found from P0, P1, and t only.',
      },
      {
        text: 'One third of the way along, because a cubic\'s control polygon has three segments.',
        correct: false,
        why: 'The number of segments does not matter. Each segment is cut at the fraction t, which here is ½.',
      },
    ],
  },

  {
    stage: 2,
    title: 'The midpoint equation',
    type: 'info',
    text: `
      <p>The midpoint M of a segment with endpoints A = (xA, yA) and
      B = (xB, yB) is</p>
      <pre class="box code">M = (A + B) / 2

xM = (xA + xB) / 2
yM = (yA + yB) / 2</pre>
      <p>More generally, the point a fraction t of the way from A to B is
      (1 − t)A + tB. At t = ½ this is the midpoint.</p>`,
  },

  {
    stage: 2,
    title: 'Place the midpoints',
    type: 'place',
    text: `
      <p>Click on the canvas to place the midpoint of each segment of the
      control polygon: P0P1, P1P2, and P2P3. A point snaps into place when
      you click close enough to it.</p>
      <p>Each new point is named after the segment it is on: the midpoint
      of P0P1 is called P01.</p>`,
    targets: ['P01', 'P12', 'P23'],
    hint: 'Look for the point exactly halfway between the two endpoints of a segment of the dashed control polygon.',
    view: { construction: true },
  },

  // ---------------------------------------------------------------------------
  // Stage 3. Connect the new points and cut again.
  // ---------------------------------------------------------------------------
  {
    stage: 3,
    title: 'Connect the midpoints',
    type: 'connect',
    text: `
      <p>The three midpoints are the corners of a new, smaller polygon.
      Connect them with segments: click one point, then another.</p>`,
    segments: [['P01', 'P12'], ['P12', 'P23']],
    view: { construction: true },
  },

  {
    stage: 3,
    title: 'Cut the new segments',
    type: 'mc',
    id: 'cut-again',
    text: '',
    question: 'You now have two new segments, P01P12 and P12P23. Where should each one be cut?',
    options: [
      {
        text: 'At its midpoint, using t = ½ again.',
        correct: true,
        why: 'Yes. Every level uses the same t, so every cut is at a midpoint.',
      },
      {
        text: 'Where it touches the curve.',
        correct: false,
        why: 'These segments generally do not touch the curve. The cut is found from each segment\'s endpoints and t only. (One segment does touch the curve soon. Watch for it.)',
      },
      {
        text: 'At a new value of t, chosen to fit the curve better.',
        correct: false,
        why: 'The algorithm uses the same t at every level. Mixing different values of t gives a point that is generally not on the curve.',
      },
      {
        text: 'They don\'t need to be cut: P12 is already the cut point.',
        correct: false,
        why: 'P12 is a midpoint of the control polygon, but it is not on the curve. Keep cutting until only one point is left.',
      },
    ],
    view: { construction: true },
  },

  {
    stage: 3,
    title: 'Place the next midpoints',
    type: 'place',
    text: `<p>Click to place the midpoints of P01P12 and P12P23. They are called
      P012 and P123.</p>`,
    targets: ['P012', 'P123'],
    hint: 'Look at the orange segments you just drew. Each new point is halfway along one of them.',
    view: { construction: true },
  },

  {
    stage: 3,
    title: 'Connect again',
    type: 'connect',
    text: `<p>Connect the two newest points.</p>`,
    segments: [['P012', 'P123']],
    view: { construction: true },
  },

  {
    stage: 3,
    title: 'The last midpoint',
    type: 'place',
    text: `<p>Only one segment is left. Place its midpoint, P0123.</p>`,
    targets: ['P0123'],
    hint: 'The point is halfway along the segment from P012 to P123.',
    view: { construction: true },
  },

  {
    stage: 3,
    title: 'What is special about P0123?',
    type: 'mc',
    id: 'p0123',
    text: '',
    question: 'Only one point is left: P0123. What is special about it?',
    options: [
      {
        text: 'It lies on the curve: it is B(½), the point where the curve is cut.',
        correct: true,
        why: 'Yes. The last point of de Casteljau\'s construction is always on the curve. It is B(t), here B(½).',
      },
      {
        text: 'It is the midpoint of segment P0P3.',
        correct: false,
        why: 'The midpoint of P0P3 is somewhere else (look near the bottom of the picture). P0123 depends on all four control points, not only the two ends.',
      },
      {
        text: 'It is the centroid of the four control points.',
        correct: false,
        why: 'The centroid, (P0 + P1 + P2 + P3) / 4, is somewhere else. The inner control points count more toward P0123 than the endpoints do.',
      },
      {
        text: 'Nothing: it is just another midpoint.',
        correct: false,
        why: 'It is a midpoint, but also something more. Look at where it is compared with the curve.',
      },
    ],
    view: { construction: true },
    viewAfter: { markCut: true },
  },

  {
    stage: 3,
    title: 'The last segment',
    type: 'mc',
    id: 'tangent',
    text: '',
    question: 'Look at segment P012P123, the last one you cut. How is it related to the curve?',
    options: [
      {
        text: 'It is tangent to the curve at P0123.',
        correct: true,
        why: 'Yes. The line through P012 and P123 touches the curve at P0123 and has the curve\'s direction there. Both pieces will leave P0123 along this line, so they join smoothly, without a corner.',
      },
      {
        text: 'It crosses the curve at two points.',
        correct: false,
        why: 'Look closely at P0123: the segment touches the curve there without crossing it.',
      },
      {
        text: 'It is parallel to segment P0P3.',
        correct: false,
        why: 'Not in general. Compare the two directions in the picture.',
      },
      {
        text: 'It is perpendicular to the curve at P0123.',
        correct: false,
        why: 'The segment runs along the curve at P0123, not across it.',
      },
    ],
    view: { construction: true, markCut: true },
    viewAfter: { tangentAtCut: true },
  },

  // ---------------------------------------------------------------------------
  // Stage 4. Find the control points of the two pieces.
  // ---------------------------------------------------------------------------
  {
    stage: 4,
    title: 'The first piece, L',
    type: 'pick',
    id: 'pick-L',
    name: 'L',
    text: `
      <p>You have built every point. Four of them are the control points of
      the first piece of the curve, <strong>L</strong>, which runs from P0
      to the cut point.</p>
      <p>Click L's four control points in order, starting at P0. The
      triangle in the panel shows all the points.</p>`,
    answer: ['P0', 'P01', 'P012', 'P0123'],
    hints: [
      'L starts where the curve starts and ends where the curve is cut.',
      'Use one point from each row of the triangle.',
      'Go down the left edge of the triangle.',
    ],
    view: { construction: true, markCut: true },
  },

  {
    stage: 4,
    title: 'The second piece, R',
    type: 'pick',
    id: 'pick-R',
    name: 'R',
    text: `
      <p>Now pick the control points of the second piece, <strong>R</strong>,
      which runs from the cut point to the end of the curve. Click them in
      order, starting at the cut point.</p>`,
    answer: ['P0123', 'P123', 'P23', 'P3'],
    hints: [
      'R starts at the cut point and ends where the curve ends.',
      'Use one point from each row of the triangle.',
      'Go up the right edge of the triangle.',
    ],
    view: { construction: true, markCut: true, showL: true },
  },

  {
    stage: 4,
    title: 'Two curves from one',
    type: 'info',
    text: `
      <p>L (purple) and R (green) are drawn on top of the original curve
      (wide gray). Together they trace the original curve
      <strong>exactly</strong>: nothing is approximated.</p>
      <p>Each piece is a cubic Bézier curve with its own four control
      points. Compare each piece's control polygon with the original one:
      the new polygons lie much closer to the curve.</p>`,
    view: { LR: true },
  },

  {
    stage: 4,
    title: 'A shared point',
    type: 'mc',
    id: 'shared-point',
    text: '',
    question: 'Why is P0123 a control point of both L and R?',
    options: [
      {
        text: 'It is where L ends and R begins, so both curves pass through it.',
        correct: true,
        why: 'Yes. A Bézier curve passes through its first and last control points. L ends at the cut point and R starts there, so the pieces meet with no gap.',
      },
      {
        text: 'Every construction point is used twice.',
        correct: false,
        why: 'Most points are used once, and P12 is not used at all.',
      },
      {
        text: 'It is halfway along the curve by length.',
        correct: false,
        why: 'Remember stage 1: B(½) is generally not halfway along the curve by length.',
      },
      {
        text: 'So that L and R have the same number of control points.',
        correct: false,
        why: 'Each piece is a cubic, so each has four control points either way. The reason is where P0123 is.',
      },
    ],
    view: { LR: true },
  },

  {
    stage: 4,
    title: 'Does the order matter?',
    type: 'mc',
    id: 'order',
    text: '',
    question: 'You had to click the control points in order. Why does the order matter?',
    options: [
      {
        text: 'The first and last points must be the ends of the curve, with the middle points in order between them.',
        correct: true,
        why: 'Yes. A Bézier curve passes through its first and last control points; the middle ones pull the curve toward them without touching it. Reversing the whole list traces the same curve backward, but any other order gives a different curve.',
      },
      {
        text: 'It doesn\'t: any order of the same four points gives the same curve.',
        correct: false,
        why: 'Try it in the Bézier playground: swapping P1 and P2 changes the curve.',
      },
      {
        text: 'Only the control polygon changes; the curve stays the same.',
        correct: false,
        why: 'The curve depends on the order too. The ends of the curve are always the first and last control points.',
      },
      {
        text: 'Only for R, because R is traced from the middle of the original curve.',
        correct: false,
        why: 'Order matters for every Bézier curve, L included.',
      },
    ],
    view: { LR: true },
  },

  // ---------------------------------------------------------------------------
  // Stage 5. Cut one of the pieces again.
  // ---------------------------------------------------------------------------
  {
    stage: 5,
    title: 'Pick a piece to cut',
    type: 'choose-half',
    text: `
      <p>L and R are Bézier curves, so we can cut each of them exactly the
      same way. Pick one of them to cut.</p>
      <p>To keep the names short, the piece you pick is called
      <strong>Q</strong>, and its control points are Q0, Q1, Q2, Q3. Its
      construction points are named as before: Q01, Q012, and so on.</p>`,
    view: { LR: true },
  },

  {
    stage: 5,
    title: 'Cut Q in two',
    type: 'place',
    ordered: true,
    autoConnect: true,
    text: `
      <p>Cut Q at t = ½. Place all six construction points, level by level,
      starting with the midpoints of Q's control polygon (dashed, in Q's
      color). Segments between neighboring points are drawn for you.</p>`,
    targets: ['Q01', 'Q12', 'Q23', 'Q012', 'Q123', 'Q0123'],
    hint: 'Start with the midpoints of the segments Q0Q1, Q1Q2, and Q2Q3. Then cut each new segment at its midpoint, until one point is left.',
    view: { half: true, construction: true },
  },

  {
    stage: 5,
    title: 'Q\'s first piece',
    type: 'pick',
    id: 'pick-QL',
    name: 'QL',
    text: `<p>Click the control points of Q's first piece, <strong>QL</strong>,
      in order, starting at Q0.</p>`,
    answer: ['Q0', 'Q01', 'Q012', 'Q0123'],
    hints: [
      'QL starts where Q starts and ends where Q is cut.',
      'Use one point from each row of the triangle.',
      'Go down the left edge of the triangle.',
    ],
    view: { half: true, construction: true },
  },

  {
    stage: 5,
    title: 'Q\'s second piece',
    type: 'pick',
    id: 'pick-QR',
    name: 'QR',
    text: `<p>Now click the control points of <strong>QR</strong> in order,
      starting at the cut point Q0123.</p>`,
    answer: ['Q0123', 'Q123', 'Q23', 'Q3'],
    hints: [
      'QR starts at the cut point and ends where Q ends.',
      'Use one point from each row of the triangle.',
      'Go up the right edge of the triangle.',
    ],
    view: { half: true, construction: true },
  },

  {
    stage: 5,
    title: 'Three pieces',
    type: 'info',
    text: `
      <p>The curve is now made of three cubic Bézier curves: QL, QR, and
      the piece you did not cut. Together they still trace the original
      curve exactly.</p>
      <p>Compare the control polygons: each cut gives polygons that follow
      the curve more closely. If we keep cutting, every control polygon
      eventually looks like a single line segment.</p>`,
    view: { halfCut: true },
  },

  {
    stage: 5,
    title: 'Counting pieces',
    type: 'mc',
    id: 'count-pieces',
    text: '',
    question: 'Suppose we cut every piece at each level: 1 curve, then 2 pieces, and so on. How many pieces are there after 3 levels of cutting?',
    options: [
      {
        text: '8',
        correct: true,
        why: 'Yes. Each level cuts every piece in two, doubling the count: 2 × 2 × 2 = 8. After k levels there are 2^k pieces.',
      },
      {
        text: '6',
        correct: false,
        why: 'That adds 2 pieces per level. But every piece is cut in two at each level, so the count doubles: 2, 4, 8.',
      },
      {
        text: '9',
        correct: false,
        why: 'Each cut makes two pieces, not three. The count doubles at each level: 2, 4, 8.',
      },
      {
        text: '4',
        correct: false,
        why: 'That is the count after 2 levels. A third level cuts each of those 4 pieces in two.',
      },
    ],
    view: { halfCut: true },
  },

  // ---------------------------------------------------------------------------
  // Stage 6. When to stop: a choice that depends on the context.
  // ---------------------------------------------------------------------------
  {
    stage: 6,
    title: 'When should we stop?',
    type: 'info',
    text: `
      <p>Each cut gives pieces that are closer to straight. At some point a
      piece is close enough to a line segment that we can draw it as one
      segment and stop cutting it.</p>
      <p>There is no single right rule for when to stop. It is a choice you
      make, and a good choice depends on what you are drawing: how accurate
      the drawing must be, how big the curve is on the screen, and how much
      time there is. On the next page, try three possible rules.</p>`,
  },

  {
    stage: 6,
    title: 'What does "flat enough" mean?',
    type: 'flatness',
    tolerance: 4,  // Starting tolerance, in world units.
    text: `
      <p>One common rule is to stop when a piece is <strong>flat
      enough</strong>. To judge that, compare the piece with its
      <strong>chord</strong> (dashed): the segment from its first control
      point to its last. The chord is what we would draw in place of the
      piece.</p>
      <p>Measure how far each inner control point is from the chord (d1 and
      d2). If both are within the tolerance (the green band), the piece is
      flat enough, and we draw its chord.</p>
      <p>Why measure the control points instead of the curve? The curve
      always stays inside the shaded region spanned by its control points
      (its <em>convex hull</em>). So if the control points are close to the
      chord, the whole curve is too.</p>
      <p><strong>Try it:</strong> cut the piece and look at its halves. Each
      cut makes the distances about 4 times smaller. Find a piece that is
      flat enough, and change the tolerance.</p>`,
    view: { flatness: true },
  },

  {
    stage: 6,
    title: 'Try three stopping rules',
    type: 'explore-stop',
    text: `
      <p>Here are three possible stopping rules. Try each one and change its
      setting. The canvas shows the line segments that would be drawn in
      place of the curve (dots mark where segments meet). Each rule also
      stops at level 10, as a safety net.</p>`,
    rules: {
      depth: {
        label: 'Fixed number of levels',
        text: 'Cut every piece the same number of times. The number of segments is always 2^levels, no matter where the curve bends.',
        setting: 'Levels', min: 0, max: 7, step: 1, value: 3, unit: '',
      },
      flat: {
        label: 'Flat enough',
        text: 'Stop when both inner control points are within a tolerance of the chord, the segment from the first to the last control point. The tolerance is in screen pixels, so try resizing the window too.',
        setting: 'Tolerance', min: 0.25, max: 20, step: 0.25, value: 2, unit: ' px',
      },
      length: {
        label: 'Short enough',
        text: 'Stop when the piece\'s control polygon is shorter than a set length, in screen pixels. Long pieces are cut even if they are already straight.',
        setting: 'Maximum length', min: 10, max: 400, step: 10, value: 80, unit: ' px',
      },
    },
    view: { stopRule: true },
  },

  {
    stage: 6,
    title: 'Judging by the control points',
    type: 'mc',
    id: 'convex-hull',
    text: '',
    question: 'The flatness rule measures the control points, not the curve itself. Why is that safe?',
    options: [
      {
        text: 'The curve always lies inside the convex hull of its control points, so if they are within the tolerance of the chord, so is the curve.',
        correct: true,
        why: 'Yes. This is the convex hull property. It lets us test four points instead of the whole curve.',
      },
      {
        text: 'The control points are all on the curve.',
        correct: false,
        why: 'Only the first and last control points are on the curve. The inner ones are generally off it.',
      },
      {
        text: 'It is not safe; it is only faster.',
        correct: false,
        why: 'It is faster, but it is also safe, for a reason that holds for every Bézier curve. Think about where the curve can be compared with its control points.',
      },
      {
        text: 'The chord passes through all the control points.',
        correct: false,
        why: 'The chord joins the first and last control points. The inner control points are generally off it; the test measures how far off.',
      },
    ],
  },

  {
    stage: 6,
    title: 'Choosing for a context',
    type: 'mc',
    id: 'context-zoom',
    text: '',
    question: 'A program draws text, and the user can zoom from tiny to huge. Which stopping rule fits best?',
    options: [
      {
        text: 'Flat enough, with the tolerance in screen pixels.',
        correct: true,
        why: 'Yes. Zoomed in, the curves are bigger on screen and need more segments to look smooth; zoomed out, a few segments are enough. A tolerance in pixels adapts to both automatically.',
      },
      {
        text: 'A fixed number of levels.',
        correct: false,
        why: 'This would be a reasonable choice if the text were always the same size. With zooming, the segments become visible when zoomed in, and many segments are wasted on curves only a few pixels wide when zoomed out.',
      },
      {
        text: 'Short enough, with the length in screen pixels.',
        correct: false,
        why: 'This adapts to zooming, so it is better than a fixed number of levels. But it also cuts long pieces that are already straight, which wastes segments.',
      },
      {
        text: 'Always cut 10 levels, to be safe.',
        correct: false,
        why: 'That is 1024 segments for every curve, even a tiny one. Accurate, but far more work than needed.',
      },
    ],
  },

  {
    stage: 6,
    title: 'A fixed number of levels',
    type: 'mc',
    id: 'context-depth',
    text: '',
    question: 'When could a fixed number of levels be the better choice?',
    options: [
      {
        text: 'When every curve is about the same size on screen and the work must be predictable, e.g. a fixed time budget per frame.',
        correct: true,
        why: 'Yes. A fixed number of levels always costs the same and needs no flatness test. If the curves are all similar, a level count can be chosen once that looks good for all of them.',
      },
      {
        text: 'When the curve bends sharply in one place and is nearly straight elsewhere.',
        correct: false,
        why: 'That is where the flatness rule shines: it cuts more near the sharp bend and less elsewhere. A fixed number of levels cuts everywhere equally.',
      },
      {
        text: 'When the drawing must be as accurate as possible.',
        correct: false,
        why: 'For a guaranteed accuracy, the flatness rule is the natural choice: its tolerance is exactly a bound on the error.',
      },
      {
        text: 'Never: it is always worse than the flatness rule.',
        correct: false,
        why: 'Every rule is a tradeoff. A fixed number of levels is simple and predictable, which can matter more than saving segments.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Stage 7. Trace the recursion.
  // ---------------------------------------------------------------------------
  {
    stage: 7,
    title: 'Trace the recursion',
    type: 'trace',
    tolerance: 4,      // Flatness tolerance, in world units.
    predictions: 3,    // Ask the student to predict the first 3 line segments.
    text: `
      <p>Here is the recursion. <code>drawBezier(piece)</code> checks the
      stopping rule. If the piece is flat enough, it draws one line segment,
      from its first to its last control point, and returns. Otherwise it
      cuts the piece into L and R, and calls <code>drawBezier</code> on L,
      then on R.</p>
      <p>This run uses the flatness rule with a tolerance of 4 units (each
      grid square is 50 units wide). Pieces are
      named by the cuts that made them: LR is the R piece of the L
      piece.</p>
      <p>Click <strong>Step</strong> to go one event at a time. Sometimes you
      will be asked to predict where the next line segment will be drawn:
      click there on the canvas.</p>`,
    view: { trace: true },
  },

  {
    stage: 7,
    title: 'The order of the segments',
    type: 'mc',
    id: 'trace-order',
    text: '',
    question: 'In what order were the line segments drawn?',
    options: [
      {
        text: 'From the start of the curve to its end, because each call finishes L completely before it starts R.',
        correct: true,
        why: 'Yes. The recursion goes as deep as it needs to on the left first (depth-first), so the segments appear in order along the curve.',
      },
      {
        text: 'The big pieces first, then the smaller ones.',
        correct: false,
        why: 'That would be level by level (breadth-first). This recursion finishes each L piece completely, down to its line segments, before it starts on the matching R piece.',
      },
      {
        text: 'From the end of the curve to its start.',
        correct: false,
        why: 'Each call handles L, the piece that starts where the curve starts, before R.',
      },
      {
        text: 'In no particular order.',
        correct: false,
        why: 'The order follows directly from the calls: L before R, at every level.',
      },
    ],
    view: { trace: true },
  },

  {
    stage: 7,
    title: 'Deeper in some places',
    type: 'mc',
    id: 'trace-depth',
    text: '',
    question: 'Some branches of the recursion went deeper than others. Why?',
    options: [
      {
        text: 'Where the curve bends more, a piece needs more cuts before it is flat enough.',
        correct: true,
        why: 'Yes. The flatness rule spends segments where the curve bends and saves them where it is nearly straight.',
      },
      {
        text: 'The recursion always goes deeper on the left.',
        correct: false,
        why: 'L and R are tested by the same rule. Depth depends on the shape of each piece, not on its side.',
      },
      {
        text: 'Longer pieces are always cut more.',
        correct: false,
        why: 'This run uses the flatness rule, which ignores length: a long, straight piece is not cut at all.',
      },
      {
        text: 'The depth is chosen at random.',
        correct: false,
        why: 'Nothing is random: the same curve and tolerance always give the same calls.',
      },
    ],
    view: { trace: true },
  },

  // ---------------------------------------------------------------------------
  // Stage 8. Write the algorithm.
  // ---------------------------------------------------------------------------
  {
    stage: 8,
    title: 'Write the algorithm',
    type: 'parsons',
    id: 'parsons',
    text: `
      <p>Here is <code>drawBezier</code> in pseudocode, with its lines
      shuffled. Before you start, think about:</p>
      <ul>
        <li>What is the base case, and what does it draw?</li>
        <li>In the recursive case, which points does it compute, and which
        calls does it make?</li>
      </ul>
      <p><code>shouldStop</code> is your stopping rule from stage 6, and
      <code>midpoint(A, B) = (A + B) / 2</code>.</p>
      <p>Put the lines in order with the ↑ and ↓ buttons, then check. Lines
      that do the same kind of work (for example, the three first-level
      midpoints) may come in either order among themselves.</p>`,
    // Lines with the same group number may be in any order among themselves.
    lines: [
      { text: 'drawBezier(P0, P1, P2, P3, depth):', group: 0 },
      { text: '    if shouldStop(P0, P1, P2, P3) or depth == MAX_DEPTH:', group: 1 },
      { text: '        drawLine(P0, P3)', group: 2 },
      { text: '        return', group: 3 },
      { text: '    P01   = midpoint(P0, P1)', group: 4 },
      { text: '    P12   = midpoint(P1, P2)', group: 4 },
      { text: '    P23   = midpoint(P2, P3)', group: 4 },
      { text: '    P012  = midpoint(P01, P12)', group: 5 },
      { text: '    P123  = midpoint(P12, P23)', group: 5 },
      { text: '    P0123 = midpoint(P012, P123)', group: 6 },
      { text: '    drawBezier(P0, P01, P012, P0123, depth + 1)', group: 7 },
      { text: '    drawBezier(P0123, P123, P23, P3, depth + 1)', group: 7 },
    ],
    done: `The two recursive calls can be in either order and still draw the
      whole curve. Calling L first draws the segments from the start of the
      curve to its end, as in the trace.`,
    view: { trace: true },
  },

  {
    stage: 8,
    title: 'Done',
    type: 'end',
    text: `
      <p>You built recursive subdivision of a Bézier curve from scratch:
      cut the curve at t = ½ using only midpoints, take the edges of the de
      Casteljau triangle as the control points of the two pieces, and repeat
      until your stopping rule says a piece can be drawn as one line
      segment.</p>
      <h3>The algorithm</h3>
      <pre class="box code">midpoint(A, B) = (A + B) / 2

drawBezier(P0, P1, P2, P3, depth):
    if shouldStop(P0, P1, P2, P3) or depth == MAX_DEPTH:
        drawLine(P0, P3)
        return
    P01   = midpoint(P0, P1)
    P12   = midpoint(P1, P2)
    P23   = midpoint(P2, P3)
    P012  = midpoint(P01, P12)
    P123  = midpoint(P12, P23)
    P0123 = midpoint(P012, P123)
    drawBezier(P0, P01, P012, P0123, depth + 1)     // L
    drawBezier(P0123, P123, P23, P3, depth + 1)     // R

Start with: drawBezier(P0, P1, P2, P3, 0)</pre>`,
    view: { trace: true },
  },
];
