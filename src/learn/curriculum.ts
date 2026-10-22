/**
 * The full /learn curriculum (CLAUDE.md §8.4) as data. It is the single source
 * of truth for the hub's subject pages, the prerequisite graph, learning paths
 * and for build-index's prerequisite validation. Shipped lessons are matched
 * to entries here by slug: `learn-<subject>-<topic>`.
 *
 * Pure data, no DOM: imported by both the browser and Node scripts.
 */

export type Level = 'intro' | 'core' | 'advanced';

export interface CurriculumLesson {
  slug: string;
  subject: string;
  unit: string;
  /** 1-based position within the subject. */
  order: number;
  title: string;
  /** Suggested central interactive, if the curriculum names one. */
  interactive?: string;
  prerequisites: string[];
}

export interface Subject {
  id: string;
  title: string;
  blurb: string;
  /** Hue (0–360) used for this subject across the hub and the graph. */
  hue: number;
  /** Later-expansion subjects are listed but not on the main map yet. */
  later?: boolean;
  units: { title: string; lessons: CurriculumLesson[] }[];
}

type Row = [topic: string, title: string, interactive?: string];
type UnitSpec = [title: string, rows: Row[]];

const subjects: Subject[] = [];

function subject(id: string, title: string, hue: number, blurb: string, units: UnitSpec[], later = false): void {
  let order = 0;
  let prev: string | null = null;
  const s: Subject = { id, title, hue, blurb, later, units: [] };
  for (const [unitTitle, rows] of units) {
    const lessons: CurriculumLesson[] = [];
    for (const [topic, lessonTitle, interactive] of rows) {
      const slug = `learn-${id}-${topic}`;
      order++;
      // Default: each lesson builds on the one before it in the same subject.
      lessons.push({ slug, subject: id, unit: unitTitle, order, title: lessonTitle, interactive, prerequisites: prev ? [prev] : [] });
      prev = slug;
    }
    s.units.push({ title: unitTitle, lessons });
  }
  subjects.push(s);
}

subject('calc1', 'Calculus I', 12, 'Limits and derivatives: how things change, one instant at a time.', [
  [
    'Limits and continuity',
    [
      ['functions', 'Functions as machines and graphs', 'drag inputs, watch outputs trace the graph'],
      ['limits', 'Limits', 'zoom into a point infinitely; ε–δ as a target game'],
      ['continuity', 'Continuity and the intermediate value theorem'],
    ],
  ],
  [
    'The derivative',
    [
      ['derivative', 'The derivative as slope and as rate', 'secant → tangent with h slider'],
      ['derivative-rules', 'Derivative rules: power, product, quotient', 'area of a growing rectangle for the product rule'],
      ['chain-rule', 'Chain rule', 'linked gears with different ratios'],
      ['implicit-differentiation', 'Implicit differentiation and related rates', 'ladder sliding down a wall'],
    ],
  ],
  [
    'Using derivatives',
    [
      ['linear-approximation', "Linear approximation and Newton's method", 'tangent lines hunting a root'],
      ['optimization', 'Optimization', 'drag the fence; area meter peaks where the derivative is zero'],
      ['curve-sketching', 'Curve sketching: f, f′, f″ linked', 'three stacked plots, one cursor'],
      ['mean-value-theorem', 'Mean value theorem'],
      ['lhopital', "L'Hôpital's rule", 'zoom until both functions look linear'],
    ],
  ],
]);

subject('calc2', 'Calculus II', 28, 'Integrals and series: adding up infinitely many tiny pieces.', [
  [
    'Integration',
    [
      ['riemann-sums', 'Area as accumulation; Riemann sums', 'n slider, left/right/mid/trapezoid'],
      ['ftc', 'Fundamental theorem of calculus', "drag the upper limit; the area function's slope is f"],
      ['substitution', 'Substitution', 'stretching the x-axis'],
      ['integration-by-parts', 'Integration by parts', 'the area-swap picture'],
      ['partial-fractions', 'Partial fractions and trig integrals'],
      ['improper-integrals', 'Improper integrals', "finite area, infinite length: Gabriel's horn"],
    ],
  ],
  [
    'Applications',
    [
      ['volumes', 'Volumes of revolution', 'spin a 2D region into 3D'],
      ['arc-length', 'Arc length and surface area'],
    ],
  ],
  [
    'Sequences and series',
    [
      ['sequences', 'Sequences and convergence'],
      ['series', 'Series and convergence tests', 'stacking bars, harmonic vs geometric'],
      ['taylor-series', 'Taylor and Maclaurin series', 'add terms one at a time, watch the fit spread'],
      ['parametric-polar', 'Parametric curves and polar coordinates'],
    ],
  ],
]);

subject('calc3', 'Calculus III', 44, 'Multivariable calculus: slopes, volumes and flows in more than one dimension.', [
  [
    'Surfaces and derivatives',
    [
      ['surfaces', 'Functions of two variables: surfaces and contour maps', 'hiking map ↔ 3D terrain'],
      ['partial-derivatives', 'Partial derivatives', 'slice the surface along x or y'],
      ['gradient', 'Gradient and directional derivatives', 'ball on a hill, arrow points uphill'],
      ['tangent-planes', 'Tangent planes and linearization'],
      ['chain-rule', 'Multivariable chain rule'],
      ['lagrange', 'Optimization and Lagrange multipliers', 'contour lines kissing a constraint curve'],
    ],
  ],
  [
    'Multiple integrals',
    [
      ['multiple-integrals', 'Double and triple integrals', 'stack of slices'],
      ['coordinates', 'Polar, cylindrical and spherical coordinates'],
    ],
  ],
  [
    'Vector calculus',
    [
      ['vector-fields', 'Vector fields', 'particles flowing'],
      ['line-integrals', 'Line integrals and work'],
      ['div-curl', 'Divergence and curl', 'paddle wheels and sources/sinks'],
      ['big-theorems', "Green's, Stokes' and divergence theorems", 'circulation inside cancels'],
    ],
  ],
]);

subject('diffeq', 'Differential equations', 60, 'Rules for change, and the motion they produce.', [
  [
    'First-order equations',
    [
      ['slope-fields', 'What an ODE is; slope fields', 'draw a solution by following arrows'],
      ['separable', 'Separable equations; exponential growth and decay'],
      ['euler-method', "Euler's method and why step size matters"],
    ],
  ],
  [
    'Second order and systems',
    [
      ['spring-mass-damper', 'Second-order linear ODEs; the spring–mass–damper', 'under-/critically/over-damped'],
      ['resonance', 'Resonance', 'drive a spring at its natural frequency'],
      ['phase-portraits', 'Systems of ODEs and phase portraits', 'predator–prey'],
      ['stability', 'Eigenvalues ↔ stability'],
    ],
  ],
  [
    'Transforms and PDEs',
    [
      ['laplace', 'Laplace transform intuition'],
      ['pdes', 'PDEs: heat equation and wave equation', 'paint heat, watch it diffuse'],
    ],
  ],
]);

subject('linalg', 'Linear algebra', 210, 'Vectors, matrices and the geometry of linear maps — the language of ML and physics.', [
  [
    'Vectors and spaces',
    [
      ['vectors', 'Vectors: arrows, lists, and things you can add'],
      ['span', 'Linear combinations, span and basis', 'two vectors painting the plane'],
      ['independence', 'Linear independence'],
    ],
  ],
  [
    'Matrices as transformations',
    [
      ['matrix-transformations', 'Matrices as transformations of space', 'MatrixGrid: drag î and ĵ'],
      ['matrix-multiplication', 'Matrix multiplication as composition'],
      ['determinant', 'Determinant as area/volume scaling (and sign as orientation flip)'],
      ['inverse-rank', 'Inverses, rank and null space', 'squashing space to a line'],
      ['gaussian-elimination', 'Systems of equations and Gaussian elimination', 'row ops animated'],
      ['four-subspaces', 'Column space and the four fundamental subspaces'],
    ],
  ],
  [
    'Orthogonality',
    [
      ['dot-product', 'Dot product and projection', 'shadows'],
      ['gram-schmidt', 'Orthogonality, Gram–Schmidt and QR'],
      ['least-squares', 'Least squares', 'fit a line; residuals as the perpendicular drop'],
    ],
  ],
  [
    'Eigen-everything',
    [
      ['change-of-basis', 'Change of basis', 'same arrow, different coordinates'],
      ['eigenvectors', 'Eigenvectors and eigenvalues', "directions a matrix doesn't turn"],
      ['diagonalization', 'Diagonalization and matrix powers', 'Fibonacci, Markov chains'],
      ['spectral-theorem', 'Symmetric matrices and the spectral theorem'],
      ['svd', 'Singular value decomposition', 'rotate, stretch, rotate; image compression demo'],
      ['pca', 'PCA', 'find the axis of a point cloud'],
      ['positive-definite', 'Positive definite matrices and quadratic forms', 'bowls vs saddles'],
      ['tensors', 'Linear algebra for ML: tensors, batching, broadcasting'],
    ],
  ],
]);

subject('prob', 'Probability and statistics', 280, 'Reasoning under uncertainty, from coin flips to Bayesian inference.', [
  [
    'Foundations',
    [
      ['counting', 'Probability as counting and as area'],
      ['bayes', "Conditional probability and Bayes' rule", 'the disease-test square'],
      ['random-variables', 'Random variables, expectation, variance'],
      ['distributions', 'Common distributions: Bernoulli, binomial, Poisson, uniform, exponential, Gaussian', 'shape sliders'],
      ['clt', 'Law of large numbers and the central limit theorem', 'Galton board'],
    ],
  ],
  [
    'Many variables',
    [
      ['joint', 'Joint distributions, covariance, correlation'],
      ['multivariate-gaussian', 'Multivariate Gaussian', 'drag the covariance ellipse'],
    ],
  ],
  [
    'Inference',
    [
      ['mle', 'Maximum likelihood estimation'],
      ['bayesian-inference', 'Bayesian inference: prior × likelihood → posterior', 'coin-flip updating'],
      ['hypothesis-tests', 'Confidence intervals and hypothesis tests', '100 intervals, how many miss?'],
    ],
  ],
  [
    'Information and randomness',
    [
      ['entropy', 'Entropy, cross-entropy and KL divergence', 'bits, surprise'],
      ['markov-chains', 'Markov chains and random walks'],
      ['monte-carlo', 'Monte Carlo methods', 'estimate π by throwing darts'],
    ],
  ],
]);

subject('discrete', 'Discrete math', 330, 'Proofs, counting and graphs: the mathematics of computer science.', [
  [
    'Reasoning',
    [
      ['proofs', 'Logic and proofs (direct, contradiction, induction)', 'dominoes'],
      ['sets', 'Sets, functions and relations'],
    ],
  ],
  [
    'Counting and structures',
    [
      ['counting', 'Counting: permutations, combinations, pigeonhole'],
      ['recurrences', 'Recurrences and generating functions'],
      ['graphs', 'Graph basics'],
      ['modular-rsa', 'Modular arithmetic and RSA intuition'],
    ],
  ],
]);

subject('dsa', 'Data structures and algorithms', 160, 'How to organise data and solve problems fast — and prove it.', [
  [
    'Basics',
    [
      ['big-o', 'Big-O by feel', 'race growth curves; count operations live'],
      ['arrays', 'Arrays and dynamic arrays', 'amortized doubling'],
      ['linked-lists', 'Linked lists'],
      ['stacks-queues', 'Stacks and queues', 'undo, browser history'],
      ['hash-tables', 'Hash tables, collisions, load factor', 'buckets filling up'],
      ['recursion', 'Recursion and the call stack', 'stack frames growing and unwinding'],
    ],
  ],
  [
    'Sorting and searching',
    [
      ['sorting-basic', 'Sorting I: bubble, insertion, selection'],
      ['sorting-fast', 'Sorting II: merge sort and quicksort', 'divide and conquer trees; pivot choices'],
      ['heaps', 'Heaps and priority queues; heapsort'],
      ['binary-search', 'Binary search and its variants', 'the shrinking window'],
    ],
  ],
  [
    'Trees',
    [
      ['bst', 'Binary search trees'],
      ['balanced-trees', 'Balanced trees: AVL and red–black', 'rotations animated'],
      ['b-trees', 'B-trees', 'why databases love them'],
      ['tries', 'Tries'],
      ['union-find', 'Union–find', 'path compression flattening'],
    ],
  ],
  [
    'Graphs',
    [
      ['bfs-dfs', 'Graph representations; BFS and DFS', 'flood fill on a maze'],
      ['topological-sort', 'Topological sort', 'course prerequisites'],
      ['shortest-paths', 'Shortest paths: Dijkstra, Bellman–Ford, A*', 'frontier expanding'],
      ['mst', 'Minimum spanning trees: Kruskal and Prim'],
    ],
  ],
  [
    'Techniques',
    [
      ['greedy', 'Greedy algorithms and when they fail'],
      ['dynamic-programming', 'Dynamic programming', 'the table filling in: knapsack, LCS, edit distance'],
      ['backtracking', 'Backtracking', 'N-queens search tree'],
      ['two-pointers', 'Two pointers and sliding window'],
      ['segment-trees', 'Segment trees and Fenwick trees'],
      ['string-matching', 'String matching: KMP and rolling hash'],
      ['network-flow', 'Network flow', 'water through pipes'],
      ['p-vs-np', 'P vs NP and reductions, intuitively'],
    ],
  ],
]);

subject('sysdesign', 'System design', 190, 'How real systems survive millions of users, failures and the speed of light.', [
  [
    'Foundations',
    [
      ['client-server', 'Client–server and what happens when you type a URL', "packet's journey"],
      ['latency-numbers', 'Latency numbers every engineer should know', 'zoomable timeline'],
      ['scaling', 'Vertical vs horizontal scaling'],
      ['load-balancing', 'Load balancing algorithms', 'requests flowing to servers live'],
      ['caching', 'Caching: strategies, eviction (LRU/LFU), invalidation', 'hit-rate meter'],
      ['cdns', 'CDNs'],
    ],
  ],
  [
    'Data at scale',
    [
      ['databases', 'Databases: SQL vs NoSQL, indexes', 'B-tree index lookup'],
      ['replication', 'Replication: leader–follower, multi-leader', 'replication lag visualized'],
      ['sharding', 'Sharding and partitioning', 'hot shard problem'],
      ['consistent-hashing', 'Consistent hashing', 'the ring, adding/removing nodes'],
      ['cap', 'CAP theorem and consistency models', 'partition the network yourself'],
    ],
  ],
  [
    'Distributed systems',
    [
      ['queues', 'Message queues and pub/sub; backpressure'],
      ['rate-limiting', 'Rate limiting: token bucket, leaky bucket, sliding window'],
      ['raft', 'Consensus: Raft', 'leader election and log replication simulator'],
      ['idempotency', 'Idempotency, retries and exactly-once illusions'],
      ['microservices', 'Microservices vs monolith'],
      ['observability', 'Observability: logs, metrics, traces'],
      ['case-studies', 'Case studies: URL shortener, chat, news feed, rate limiter, video, dispatch, KV store', 'stress each architecture with traffic'],
    ],
  ],
]);

subject('systems', 'Computer systems', 100, 'What actually happens inside the machine: CPUs, operating systems, networks, databases.', [
  [
    'Hardware and the OS',
    [
      ['cpu', 'How a CPU runs code: fetch–decode–execute', 'tiny visible CPU'],
      ['memory-hierarchy', 'Memory hierarchy and caches', 'cache lines lighting up'],
      ['processes-threads', 'Processes, threads and context switching'],
      ['scheduling', 'CPU scheduling algorithms', 'Gantt charts'],
      ['concurrency', 'Concurrency: race conditions, locks, deadlock', 'dining philosophers'],
      ['virtual-memory', 'Virtual memory and paging', 'page table walk'],
      ['file-systems', 'File systems'],
    ],
  ],
  [
    'Networks',
    [
      ['tcp', 'Networking layers; TCP handshake and congestion control', 'sawtooth window'],
      ['dns-http-tls', 'DNS and HTTP/HTTPS, TLS handshake'],
    ],
  ],
  [
    'Databases',
    [
      ['transactions', 'Transactions, ACID and isolation levels', 'anomalies replayed'],
      ['query-planning', 'Query planning and joins'],
    ],
  ],
]);

subject('ml', 'Machine learning', 135, 'Learning from data: models, losses, and how to tell if they work.', [
  [
    'Learning from data',
    [
      ['what-is-learning', 'What learning from data means; train/test split'],
      ['linear-regression', 'Linear regression and the loss landscape', 'drag the line, watch loss'],
      ['gradient-descent', 'Gradient descent', 'ball rolling on the loss surface; learning-rate slider'],
      ['logistic-regression', 'Logistic regression and decision boundaries'],
      ['bias-variance', 'Overfitting, underfitting and bias–variance', 'polynomial degree slider'],
      ['regularization', 'Regularization: L1 vs L2', 'diamond vs circle constraints'],
      ['cross-validation', 'Cross-validation'],
    ],
  ],
  [
    'Classic models',
    [
      ['knn', 'k-nearest neighbors', 'Voronoi regions'],
      ['decision-trees', 'Decision trees', 'split the plane'],
      ['ensembles', 'Ensembles: random forests and gradient boosting', 'weak learners adding up'],
      ['svm', 'Support vector machines and the kernel trick', 'lift points into 3D'],
      ['naive-bayes', 'Naive Bayes'],
    ],
  ],
  [
    'Unsupervised learning',
    [
      ['k-means', 'k-means and clustering', 'centroids marching'],
      ['gmm-em', 'Gaussian mixture models and EM'],
      ['dim-reduction', 'PCA, t-SNE and UMAP'],
    ],
  ],
  [
    'Practice',
    [
      ['metrics', 'Evaluation metrics: precision, recall, ROC, AUC', 'threshold slider'],
      ['features-leakage', 'Feature engineering and data leakage'],
      ['intro-rl', 'Intro to reinforcement learning: bandits, MDPs, Q-learning', 'grid-world agent'],
    ],
  ],
]);

subject('dl', 'Deep learning', 300, 'Neural networks from one neuron to transformers, built from the chain rule up.', [
  [
    'Neural network basics',
    [
      ['perceptron', "The perceptron and why one neuron isn't enough", 'XOR'],
      ['mlp', 'Multilayer perceptrons: folding space', 'watch layers warp the plane'],
      ['activations', 'Activation functions'],
      ['backprop', 'Backpropagation as the chain rule on a graph', 'step-through computation graph'],
      ['losses', 'Loss functions'],
    ],
  ],
  [
    'Training well',
    [
      ['optimizers', 'Optimizers: SGD, momentum, RMSProp, Adam', 'race on a nasty surface'],
      ['initialization', 'Initialization, vanishing/exploding gradients'],
      ['normalization', 'Batch norm, layer norm'],
      ['dropout', 'Dropout and regularization'],
    ],
  ],
  [
    'Architectures',
    [
      ['convolutions', 'Convolutions', 'kernel sliding over an image you draw'],
      ['cnns', 'CNN architectures and receptive fields; what filters learn'],
      ['resnets', 'ResNets and skip connections'],
      ['rnns', 'RNNs, LSTMs and GRUs', 'memory over time'],
      ['embeddings', 'Embeddings', 'word vectors in 2D/3D'],
      ['attention', 'Attention', 'query–key–value as soft lookup'],
      ['transformers', 'Transformers block by block'],
    ],
  ],
  [
    'Generative models and scale',
    [
      ['autoencoders', 'Autoencoders and the latent space'],
      ['vaes', 'Variational autoencoders', 'walk the latent space'],
      ['gans', 'GANs', 'generator vs discriminator tug of war'],
      ['unets', 'U-Nets'],
      ['scale', 'Training at scale: batching, mixed precision, data/model parallelism'],
      ['interpretability', 'Interpretability basics: saliency, probing, features'],
    ],
  ],
]);

subject('diffusion', 'Diffusion models', 320, 'How image generators turn pure noise into pictures, one denoising step at a time.', [
  [
    'Noise and denoising',
    [
      ['generative-modeling', 'Generative modeling: learning a distribution', '2D toy datasets'],
      ['forward-process', 'Adding noise: the forward process', 'a spiral dissolving into a Gaussian blob'],
      ['noise-schedules', 'Noise schedules', 'linear vs cosine'],
      ['reverse-process', 'Learning to denoise: the reverse process', 'step back from noise'],
      ['score-matching', 'Score functions and score matching', 'arrows pointing toward data'],
      ['ddpm', 'DDPM, step by step, with a tiny model trained live on 2D data'],
    ],
  ],
  [
    'Sampling and conditioning',
    [
      ['ddim', 'DDIM and faster sampling'],
      ['sde-ode', 'The SDE/ODE view; probability flow'],
      ['guidance', 'Conditioning and classifier-free guidance', 'guidance-scale slider'],
      ['latent-diffusion', "Latent diffusion: diffusing in a VAE's latent space"],
      ['text-to-image', 'Text-to-image pipeline anatomy: text encoder, U-Net/DiT, cross-attention'],
    ],
  ],
  [
    'Beyond DDPM',
    [
      ['flow-matching', 'Flow matching and rectified flow', 'straightening the paths'],
      ['consistency-models', 'Consistency models and distillation'],
    ],
  ],
]);

subject('llm', 'Large language models', 250, 'Next-token prediction at scale: tokens, attention, training, sampling and agents.', [
  [
    'Inside the model',
    [
      ['next-token', 'Language modeling as next-token prediction', 'predict-the-next-word game'],
      ['tokenization', 'Tokenization and BPE', 'watch merges build a vocabulary'],
      ['positional', 'Embeddings and positional encodings', 'rotary embeddings as rotations'],
      ['self-attention', 'Self-attention, in full detail', 'attention matrix you can probe'],
      ['multi-head', 'Multi-head attention'],
      ['decoder', 'The transformer decoder, assembled', 'data flowing through each block'],
    ],
  ],
  [
    'Training and inference',
    [
      ['training', 'Training: cross-entropy, batching, learning-rate schedules'],
      ['scaling-laws', 'Scaling laws', 'loss vs compute curves'],
      ['sampling', 'Sampling: greedy, temperature, top-k, top-p', 'same prompt, different dice'],
      ['kv-cache', 'The KV cache and inference cost'],
    ],
  ],
  [
    'Adapting models',
    [
      ['fine-tuning', 'Fine-tuning and instruction tuning'],
      ['rlhf-dpo', 'RLHF and preference optimization (DPO) intuition'],
      ['lora', 'LoRA and parameter-efficient fine-tuning', 'low-rank update as a thin matrix'],
      ['quantization', 'Quantization', 'precision slider vs quality'],
    ],
  ],
  [
    'Systems around the model',
    [
      ['rag', 'Retrieval-augmented generation', 'embedding search in 2D'],
      ['agents', 'Tool use and agents: the loop'],
      ['moe', 'Mixture of experts', 'router choosing experts per token'],
      ['long-context', 'Long context: attention variants and positional extrapolation'],
      ['evaluation', 'Evaluation and failure modes: hallucination, prompt injection'],
      ['tiny-gpt', 'A tiny GPT trained in your browser, end to end (capstone)'],
    ],
  ],
]);

subject('phys1', 'Physics 1: mechanics', 190, 'Motion, forces, energy and waves — Newton to thermodynamics.', [
  [
    'Motion',
    [
      ['units-vectors', 'Units, vectors and measurement'],
      ['kinematics', 'Kinematics in 1D: position, velocity, acceleration graphs linked', 'drive the car'],
      ['projectiles', 'Projectile motion', 'cannon with angle/speed; the dotted trajectory'],
    ],
  ],
  [
    'Forces',
    [
      ['newtons-laws', "Newton's laws and free-body diagrams", 'build the FBD by dragging forces'],
      ['friction', 'Friction and inclined planes'],
      ['circular-motion', 'Circular motion and centripetal force'],
    ],
  ],
  [
    'Energy and momentum',
    [
      ['work-energy', 'Work, kinetic and potential energy', 'roller coaster energy bars'],
      ['conservation-of-energy', 'Conservation of energy'],
      ['momentum', 'Momentum, impulse and collisions', 'elastic vs inelastic air track'],
      ['center-of-mass', 'Center of mass'],
    ],
  ],
  [
    'Rotation and gravity',
    [
      ['torque', 'Rotational kinematics and torque', 'seesaw, wrench'],
      ['moment-of-inertia', 'Moment of inertia and rolling', 'race shapes down a ramp'],
      ['angular-momentum', 'Angular momentum', 'spinning skater'],
      ['orbits', "Gravitation and orbits; Kepler's laws", 'launch satellites'],
    ],
  ],
  [
    'Oscillations, waves and heat',
    [
      ['shm', 'Simple harmonic motion and pendulums'],
      ['waves', 'Waves: wavelength, frequency, superposition', 'two sources interfering'],
      ['standing-waves', 'Standing waves and sound', 'string harmonics you hear'],
      ['fluids', 'Fluids: pressure, buoyancy, Bernoulli'],
      ['ideal-gas', 'Thermodynamics: temperature, heat, ideal gas', 'box of bouncing particles'],
      ['thermo-laws', 'Laws of thermodynamics, heat engines and entropy', 'PV diagram cycles'],
    ],
  ],
]);

subject('phys2', 'Physics 2: electricity and magnetism', 50, 'Charges, fields, circuits and light — all the way to Maxwell.', [
  [
    'Electrostatics',
    [
      ['coulomb', "Electric charge and Coulomb's law", 'drag charges, read forces'],
      ['electric-fields', 'Electric fields and field lines'],
      ['gauss', "Gauss's law", 'flux through a surface you resize'],
      ['potential', 'Electric potential and equipotentials', '3D potential landscape'],
      ['capacitance', 'Capacitance and dielectrics'],
    ],
  ],
  [
    'Circuits',
    [
      ['ohms-law', "Current, resistance and Ohm's law", 'electron drift'],
      ['kirchhoff', "DC circuits: Kirchhoff's laws", 'build circuits, see current flow'],
      ['rc-circuits', 'RC circuits', 'charging curve'],
    ],
  ],
  [
    'Magnetism',
    [
      ['magnetic-force', 'Magnetic fields and forces on charges', 'cyclotron spirals'],
      ['biot-savart', 'Biot–Savart and Ampère\'s law', 'field around wires and loops'],
      ['faraday', "Faraday's law and induction", 'magnet through a coil; generator'],
      ['lenz', "Lenz's law"],
      ['inductance', 'Inductance, RL and LC circuits', 'energy sloshing between L and C'],
      ['ac-circuits', 'AC circuits and resonance; phasors', 'rotating arrows'],
    ],
  ],
  [
    'Light',
    [
      ['maxwell', "Maxwell's equations together", 'one interactive per equation'],
      ['em-waves', 'Electromagnetic waves', 'E and B in step'],
      ['geometric-optics', 'Geometric optics: reflection, refraction, lenses', 'ray-tracing bench'],
      ['wave-optics', 'Wave optics: interference and diffraction', 'double slit'],
    ],
  ],
]);

subject(
  'beyond',
  'Beyond',
  0,
  'Later expansion: modern physics, signals, numerics, graphics, deep RL, compilers and cryptography.',
  [
    [
      'Modern physics',
      [
        ['relativity', 'Special relativity', 'light clocks, Minkowski diagrams'],
        ['photoelectric', 'The photoelectric effect'],
        ['bohr-model', 'The Bohr model'],
        ['quantum-intro', 'Intro quantum mechanics', 'wavefunction in a box, tunneling'],
      ],
    ],
    [
      'Signals and systems',
      [
        ['fourier', 'Fourier series and transform', 'epicycles'],
        ['sampling-aliasing', 'Sampling and aliasing'],
        ['convolution', 'Convolution'],
        ['filters', 'Filters'],
      ],
    ],
    [
      'Numerics and optimization',
      [
        ['information-theory', 'Information theory'],
        ['numerical-methods', 'Numerical methods'],
        ['optimization', 'Optimization: convex and constrained'],
      ],
    ],
    [
      'Graphics',
      [
        ['rasterization', 'Rasterization'],
        ['ray-tracing', 'Ray tracing'],
        ['shaders', 'Shaders'],
      ],
    ],
    [
      'Deep reinforcement learning',
      [
        ['policy-gradients', 'Policy gradients'],
        ['ppo', 'PPO'],
        ['alphazero', 'AlphaZero-style search'],
      ],
    ],
    [
      'Compilers and cryptography',
      [
        ['compilers', 'Compilers: lexing, parsing, ASTs'],
        ['hashing', 'Cryptographic hashing'],
        ['public-key', 'Public-key cryptography'],
        ['zero-knowledge', 'Zero-knowledge intuition'],
      ],
    ],
  ],
  true,
);

/**
 * Cross-subject prerequisites, on top of the default "previous lesson in the
 * same subject" chain. This is what makes the prerequisite graph interesting:
 * diffusion models visibly depend on Gaussians, KL divergence, U-Nets and SDEs.
 */
const EXTRA: Record<string, string[]> = {
  'learn-calc1-functions': [],
  'learn-calc3-surfaces': ['learn-calc2-parametric-polar'],
  'learn-calc3-gradient': ['learn-linalg-dot-product'],
  'learn-calc3-lagrange': ['learn-calc1-optimization'],
  'learn-diffeq-slope-fields': ['learn-calc2-ftc'],
  'learn-diffeq-phase-portraits': ['learn-linalg-matrix-transformations'],
  'learn-diffeq-stability': ['learn-linalg-eigenvectors'],
  'learn-diffeq-pdes': ['learn-calc3-partial-derivatives'],
  'learn-linalg-least-squares': ['learn-calc1-optimization'],
  'learn-linalg-pca': ['learn-prob-joint'],
  'learn-linalg-positive-definite': ['learn-calc3-gradient'],
  'learn-prob-random-variables': ['learn-calc2-riemann-sums'],
  'learn-prob-multivariate-gaussian': ['learn-linalg-eigenvectors'],
  'learn-prob-mle': ['learn-calc1-optimization'],
  'learn-prob-entropy': ['learn-calc1-functions'],
  'learn-prob-markov-chains': ['learn-linalg-diagonalization'],
  'learn-discrete-graphs': ['learn-discrete-sets'],
  'learn-dsa-big-o': ['learn-discrete-proofs'],
  'learn-dsa-recursion': ['learn-discrete-recurrences'],
  'learn-dsa-bfs-dfs': ['learn-discrete-graphs', 'learn-dsa-stacks-queues'],
  'learn-dsa-heaps': ['learn-dsa-recursion'],
  'learn-dsa-p-vs-np': ['learn-discrete-proofs'],
  'learn-sysdesign-databases': ['learn-dsa-b-trees'],
  'learn-sysdesign-consistent-hashing': ['learn-dsa-hash-tables'],
  'learn-sysdesign-caching': ['learn-systems-memory-hierarchy'],
  'learn-sysdesign-client-server': ['learn-systems-tcp'],
  'learn-systems-cpu': [],
  'learn-systems-transactions': ['learn-systems-concurrency'],
  'learn-systems-query-planning': ['learn-dsa-b-trees'],
  'learn-ml-what-is-learning': ['learn-prob-random-variables'],
  'learn-ml-linear-regression': ['learn-linalg-least-squares'],
  'learn-ml-gradient-descent': ['learn-calc3-gradient'],
  'learn-ml-logistic-regression': ['learn-prob-mle'],
  'learn-ml-naive-bayes': ['learn-prob-bayes'],
  'learn-ml-gmm-em': ['learn-prob-multivariate-gaussian'],
  'learn-ml-dim-reduction': ['learn-linalg-pca'],
  'learn-ml-svm': ['learn-linalg-dot-product'],
  'learn-ml-intro-rl': ['learn-prob-markov-chains'],
  'learn-dl-perceptron': ['learn-ml-logistic-regression'],
  'learn-dl-backprop': ['learn-calc3-chain-rule', 'learn-calc1-chain-rule'],
  'learn-dl-losses': ['learn-prob-entropy'],
  'learn-dl-optimizers': ['learn-ml-gradient-descent'],
  'learn-dl-embeddings': ['learn-linalg-dot-product'],
  'learn-dl-attention': ['learn-linalg-matrix-multiplication'],
  'learn-dl-vaes': ['learn-prob-entropy', 'learn-prob-multivariate-gaussian'],
  'learn-dl-scale': ['learn-linalg-tensors'],
  'learn-diffusion-generative-modeling': ['learn-dl-vaes', 'learn-prob-multivariate-gaussian'],
  'learn-diffusion-forward-process': ['learn-prob-clt'],
  'learn-diffusion-reverse-process': ['learn-dl-unets', 'learn-prob-entropy'],
  'learn-diffusion-score-matching': ['learn-calc3-gradient'],
  'learn-diffusion-sde-ode': ['learn-diffeq-euler-method'],
  'learn-diffusion-latent-diffusion': ['learn-dl-vaes'],
  'learn-diffusion-text-to-image': ['learn-dl-attention'],
  'learn-llm-next-token': ['learn-prob-entropy', 'learn-dl-losses'],
  'learn-llm-positional': ['learn-dl-embeddings'],
  'learn-llm-self-attention': ['learn-dl-attention'],
  'learn-llm-decoder': ['learn-dl-transformers', 'learn-dl-normalization'],
  'learn-llm-training': ['learn-dl-optimizers'],
  'learn-llm-kv-cache': ['learn-systems-memory-hierarchy'],
  'learn-llm-lora': ['learn-linalg-svd'],
  'learn-llm-rag': ['learn-dl-embeddings'],
  'learn-llm-rlhf-dpo': ['learn-ml-intro-rl'],
  'learn-phys1-units-vectors': ['learn-linalg-vectors'],
  'learn-phys1-kinematics': ['learn-calc1-derivative'],
  'learn-phys1-work-energy': ['learn-calc2-riemann-sums'],
  'learn-phys1-shm': ['learn-diffeq-spring-mass-damper'],
  'learn-phys1-waves': ['learn-calc3-partial-derivatives'],
  'learn-phys1-ideal-gas': ['learn-prob-distributions'],
  'learn-phys2-coulomb': ['learn-phys1-newtons-laws'],
  'learn-phys2-electric-fields': ['learn-calc3-vector-fields'],
  'learn-phys2-gauss': ['learn-calc3-big-theorems'],
  'learn-phys2-rc-circuits': ['learn-diffeq-separable'],
  'learn-phys2-inductance': ['learn-diffeq-spring-mass-damper'],
  'learn-phys2-maxwell': ['learn-calc3-div-curl'],
  'learn-phys2-em-waves': ['learn-phys1-waves'],
  'learn-beyond-fourier': ['learn-calc2-taylor-series'],
  'learn-beyond-relativity': ['learn-phys1-momentum'],
  'learn-beyond-quantum-intro': ['learn-phys2-wave-optics', 'learn-prob-distributions'],
  'learn-beyond-policy-gradients': ['learn-ml-intro-rl', 'learn-dl-backprop'],
  'learn-beyond-public-key': ['learn-discrete-modular-rsa'],
  'learn-beyond-ray-tracing': ['learn-linalg-dot-product'],
};

for (const s of subjects) {
  for (const u of s.units) {
    for (const l of u.lessons) {
      for (const p of EXTRA[l.slug] ?? []) if (!l.prerequisites.includes(p)) l.prerequisites.push(p);
    }
  }
}

export const SUBJECTS: readonly Subject[] = subjects;

export const LESSONS: readonly CurriculumLesson[] = subjects.flatMap((s) => s.units.flatMap((u) => u.lessons));

export const LESSON_BY_SLUG: ReadonlyMap<string, CurriculumLesson> = new Map(LESSONS.map((l) => [l.slug, l]));

export interface LearningPath {
  id: string;
  title: string;
  blurb: string;
  /** Milestone lessons; the hub expands each to include its unmet prerequisites. */
  lessons: string[];
}

export const PATHS: readonly LearningPath[] = [
  {
    id: 'zero-to-llms',
    title: 'Zero to LLMs',
    blurb: 'From vectors and probability to a tiny GPT you train yourself.',
    lessons: [
      'learn-linalg-matrix-multiplication',
      'learn-prob-entropy',
      'learn-calc1-chain-rule',
      'learn-ml-gradient-descent',
      'learn-dl-backprop',
      'learn-dl-attention',
      'learn-llm-tokenization',
      'learn-llm-self-attention',
      'learn-llm-decoder',
      'learn-llm-sampling',
      'learn-llm-tiny-gpt',
    ],
  },
  {
    id: 'physics-for-engineers',
    title: 'Physics for engineers',
    blurb: 'Mechanics, oscillations and circuits with the calculus you need along the way.',
    lessons: [
      'learn-calc1-derivative',
      'learn-phys1-kinematics',
      'learn-phys1-newtons-laws',
      'learn-phys1-conservation-of-energy',
      'learn-diffeq-spring-mass-damper',
      'learn-phys1-shm',
      'learn-phys2-kirchhoff',
      'learn-phys2-rc-circuits',
      'learn-phys2-faraday',
      'learn-phys2-ac-circuits',
    ],
  },
  {
    id: 'interview-ready-dsa',
    title: 'Interview-ready DSA',
    blurb: 'The data structures and patterns that come up again and again.',
    lessons: [
      'learn-dsa-big-o',
      'learn-dsa-hash-tables',
      'learn-dsa-two-pointers',
      'learn-dsa-binary-search',
      'learn-dsa-heaps',
      'learn-dsa-bfs-dfs',
      'learn-dsa-topological-sort',
      'learn-dsa-shortest-paths',
      'learn-dsa-dynamic-programming',
      'learn-dsa-backtracking',
    ],
  },
  {
    id: 'ml-math-foundations',
    title: 'ML math foundations',
    blurb: 'Exactly the linear algebra, calculus and probability that machine learning leans on.',
    lessons: [
      'learn-linalg-matrix-transformations',
      'learn-linalg-eigenvectors',
      'learn-linalg-svd',
      'learn-calc3-gradient',
      'learn-calc3-lagrange',
      'learn-prob-bayes',
      'learn-prob-multivariate-gaussian',
      'learn-prob-mle',
      'learn-prob-entropy',
    ],
  },
];
