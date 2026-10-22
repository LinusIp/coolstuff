# Progress

The full curriculum (CLAUDE.md §9) and the status of every lesson. The checklist below is generated from
`src/content/curriculum.ts` and each lesson's `meta.json`: run `npm run progress:sync` after shipping.

<!-- progress:start -->
**0 of 272 lessons shipped.** `[x]` shipped · `[ ] … [in progress]` being built (status "wip")

## Calculus I — 0/12

**Limits and continuity**

- [ ] 1. Functions as machines and graphs — _drag inputs, watch outputs trace the graph_ `calc1/functions`
- [ ] 2. Limits — _zoom into a point infinitely; ε–δ as a target game_ `calc1/limits`
- [ ] 3. Continuity and the intermediate value theorem `calc1/continuity`

**The derivative**

- [ ] 4. The derivative as slope and as rate — _secant → tangent with h slider_ `calc1/derivative`
- [ ] 5. Derivative rules: power, product, quotient — _area of a growing rectangle for the product rule_ `calc1/derivative-rules`
- [ ] 6. Chain rule — _linked gears with different ratios_ `calc1/chain-rule`
- [ ] 7. Implicit differentiation and related rates — _ladder sliding down a wall_ `calc1/implicit-differentiation`

**Using derivatives**

- [ ] 8. Linear approximation and Newton's method — _tangent lines hunting a root_ `calc1/linear-approximation`
- [ ] 9. Optimization — _drag the fence; area meter peaks where the derivative is zero_ `calc1/optimization`
- [ ] 10. Curve sketching: f, f′, f″ linked — _three stacked plots, one cursor_ `calc1/curve-sketching`
- [ ] 11. Mean value theorem `calc1/mean-value-theorem`
- [ ] 12. L'Hôpital's rule — _zoom until both functions look linear_ `calc1/lhopital`

## Calculus II — 0/12

**Integration**

- [ ] 1. Area as accumulation; Riemann sums — _n slider, left/right/mid/trapezoid_ `calc2/riemann-sums`
- [ ] 2. Fundamental theorem of calculus — _drag the upper limit; the area function's slope is f_ `calc2/ftc`
- [ ] 3. Substitution — _stretching the x-axis_ `calc2/substitution`
- [ ] 4. Integration by parts — _the area-swap picture_ `calc2/integration-by-parts`
- [ ] 5. Partial fractions and trig integrals `calc2/partial-fractions`
- [ ] 6. Improper integrals — _finite area, infinite length: Gabriel's horn_ `calc2/improper-integrals`

**Applications**

- [ ] 7. Volumes of revolution — _spin a 2D region into 3D_ `calc2/volumes`
- [ ] 8. Arc length and surface area `calc2/arc-length`

**Sequences and series**

- [ ] 9. Sequences and convergence `calc2/sequences`
- [ ] 10. Series and convergence tests — _stacking bars, harmonic vs geometric_ `calc2/series`
- [ ] 11. Taylor and Maclaurin series — _add terms one at a time, watch the fit spread_ `calc2/taylor-series`
- [ ] 12. Parametric curves and polar coordinates `calc2/parametric-polar`

## Calculus III — 0/12

**Surfaces and derivatives**

- [ ] 1. Functions of two variables: surfaces and contour maps — _hiking map ↔ 3D terrain_ `calc3/surfaces`
- [ ] 2. Partial derivatives — _slice the surface along x or y_ `calc3/partial-derivatives`
- [ ] 3. Gradient and directional derivatives — _ball on a hill, arrow points uphill_ `calc3/gradient`
- [ ] 4. Tangent planes and linearization `calc3/tangent-planes`
- [ ] 5. Multivariable chain rule `calc3/chain-rule`
- [ ] 6. Optimization and Lagrange multipliers — _contour lines kissing a constraint curve_ `calc3/lagrange`

**Multiple integrals**

- [ ] 7. Double and triple integrals — _stack of slices_ `calc3/multiple-integrals`
- [ ] 8. Polar, cylindrical and spherical coordinates `calc3/coordinates`

**Vector calculus**

- [ ] 9. Vector fields — _particles flowing_ `calc3/vector-fields`
- [ ] 10. Line integrals and work `calc3/line-integrals`
- [ ] 11. Divergence and curl — _paddle wheels and sources/sinks_ `calc3/div-curl`
- [ ] 12. Green's, Stokes' and divergence theorems — _circulation inside cancels_ `calc3/big-theorems`

## Differential equations — 0/9

**First-order equations**

- [ ] 1. What an ODE is; slope fields — _draw a solution by following arrows_ `diffeq/slope-fields`
- [ ] 2. Separable equations; exponential growth and decay `diffeq/separable`
- [ ] 3. Euler's method and why step size matters `diffeq/euler-method`

**Second order and systems**

- [ ] 4. Second-order linear ODEs; the spring–mass–damper — _under-/critically/over-damped_ `diffeq/spring-mass-damper`
- [ ] 5. Resonance — _drive a spring at its natural frequency_ `diffeq/resonance`
- [ ] 6. Systems of ODEs and phase portraits — _predator–prey_ `diffeq/phase-portraits`
- [ ] 7. Eigenvalues ↔ stability `diffeq/stability`

**Transforms and PDEs**

- [ ] 8. Laplace transform intuition `diffeq/laplace`
- [ ] 9. PDEs: heat equation and wave equation — _paint heat, watch it diffuse_ `diffeq/pdes`

## Linear algebra — 0/20

**Vectors and spaces**

- [ ] 1. Vectors: arrows, lists, and things you can add `linalg/vectors`
- [ ] 2. Linear combinations, span and basis — _two vectors painting the plane_ `linalg/span`
- [ ] 3. Linear independence `linalg/independence`

**Matrices as transformations**

- [ ] 4. Matrices as transformations of space — _MatrixGrid: drag î and ĵ_ `linalg/matrix-transformations`
- [ ] 5. Matrix multiplication as composition `linalg/matrix-multiplication`
- [ ] 6. Determinant as area/volume scaling (and sign as orientation flip) `linalg/determinant`
- [ ] 7. Inverses, rank and null space — _squashing space to a line_ `linalg/inverse-rank`
- [ ] 8. Systems of equations and Gaussian elimination — _row ops animated_ `linalg/gaussian-elimination`
- [ ] 9. Column space and the four fundamental subspaces `linalg/four-subspaces`

**Orthogonality**

- [ ] 10. Dot product and projection — _shadows_ `linalg/dot-product`
- [ ] 11. Orthogonality, Gram–Schmidt and QR `linalg/gram-schmidt`
- [ ] 12. Least squares — _fit a line; residuals as the perpendicular drop_ `linalg/least-squares`

**Eigen-everything**

- [ ] 13. Change of basis — _same arrow, different coordinates_ `linalg/change-of-basis`
- [ ] 14. Eigenvectors and eigenvalues — _directions a matrix doesn't turn_ `linalg/eigenvectors`
- [ ] 15. Diagonalization and matrix powers — _Fibonacci, Markov chains_ `linalg/diagonalization`
- [ ] 16. Symmetric matrices and the spectral theorem `linalg/spectral-theorem`
- [ ] 17. Singular value decomposition — _rotate, stretch, rotate; image compression demo_ `linalg/svd`
- [ ] 18. PCA — _find the axis of a point cloud_ `linalg/pca`
- [ ] 19. Positive definite matrices and quadratic forms — _bowls vs saddles_ `linalg/positive-definite`
- [ ] 20. Linear algebra for ML: tensors, batching, broadcasting `linalg/tensors`

## Probability and statistics — 0/13

**Foundations**

- [ ] 1. Probability as counting and as area `prob/counting`
- [ ] 2. Conditional probability and Bayes' rule — _the disease-test square_ `prob/bayes`
- [ ] 3. Random variables, expectation, variance `prob/random-variables`
- [ ] 4. Common distributions: Bernoulli, binomial, Poisson, uniform, exponential, Gaussian — _shape sliders_ `prob/distributions`
- [ ] 5. Law of large numbers and the central limit theorem — _Galton board_ `prob/clt`

**Many variables**

- [ ] 6. Joint distributions, covariance, correlation `prob/joint`
- [ ] 7. Multivariate Gaussian — _drag the covariance ellipse_ `prob/multivariate-gaussian`

**Inference**

- [ ] 8. Maximum likelihood estimation `prob/mle`
- [ ] 9. Bayesian inference: prior × likelihood → posterior — _coin-flip updating_ `prob/bayesian-inference`
- [ ] 10. Confidence intervals and hypothesis tests — _100 intervals, how many miss?_ `prob/hypothesis-tests`

**Information and randomness**

- [ ] 11. Entropy, cross-entropy and KL divergence — _bits, surprise_ `prob/entropy`
- [ ] 12. Markov chains and random walks `prob/markov-chains`
- [ ] 13. Monte Carlo methods — _estimate π by throwing darts_ `prob/monte-carlo`

## Discrete math — 0/6

**Reasoning**

- [ ] 1. Logic and proofs (direct, contradiction, induction) — _dominoes_ `discrete/proofs`
- [ ] 2. Sets, functions and relations `discrete/sets`

**Counting and structures**

- [ ] 3. Counting: permutations, combinations, pigeonhole `discrete/counting`
- [ ] 4. Recurrences and generating functions `discrete/recurrences`
- [ ] 5. Graph basics `discrete/graphs`
- [ ] 6. Modular arithmetic and RSA intuition `discrete/modular-rsa`

## Data structures and algorithms — 0/27

**Basics**

- [ ] 1. Big-O by feel — _race growth curves; count operations live_ `dsa/big-o`
- [ ] 2. Arrays and dynamic arrays — _amortized doubling_ `dsa/arrays`
- [ ] 3. Linked lists `dsa/linked-lists`
- [ ] 4. Stacks and queues — _undo, browser history_ `dsa/stacks-queues`
- [ ] 5. Hash tables, collisions, load factor — _buckets filling up_ `dsa/hash-tables`
- [ ] 6. Recursion and the call stack — _stack frames growing and unwinding_ `dsa/recursion`

**Sorting and searching**

- [ ] 7. Sorting I: bubble, insertion, selection `dsa/sorting-basic`
- [ ] 8. Sorting II: merge sort and quicksort — _divide and conquer trees; pivot choices_ `dsa/sorting-fast`
- [ ] 9. Heaps and priority queues; heapsort `dsa/heaps`
- [ ] 10. Binary search and its variants — _the shrinking window_ `dsa/binary-search`

**Trees**

- [ ] 11. Binary search trees `dsa/bst`
- [ ] 12. Balanced trees: AVL and red–black — _rotations animated_ `dsa/balanced-trees`
- [ ] 13. B-trees — _why databases love them_ `dsa/b-trees`
- [ ] 14. Tries `dsa/tries`
- [ ] 15. Union–find — _path compression flattening_ `dsa/union-find`

**Graphs**

- [ ] 16. Graph representations; BFS and DFS — _flood fill on a maze_ `dsa/bfs-dfs`
- [ ] 17. Topological sort — _course prerequisites_ `dsa/topological-sort`
- [ ] 18. Shortest paths: Dijkstra, Bellman–Ford, A* — _frontier expanding_ `dsa/shortest-paths`
- [ ] 19. Minimum spanning trees: Kruskal and Prim `dsa/mst`

**Techniques**

- [ ] 20. Greedy algorithms and when they fail `dsa/greedy`
- [ ] 21. Dynamic programming — _the table filling in: knapsack, LCS, edit distance_ `dsa/dynamic-programming`
- [ ] 22. Backtracking — _N-queens search tree_ `dsa/backtracking`
- [ ] 23. Two pointers and sliding window `dsa/two-pointers`
- [ ] 24. Segment trees and Fenwick trees `dsa/segment-trees`
- [ ] 25. String matching: KMP and rolling hash `dsa/string-matching`
- [ ] 26. Network flow — _water through pipes_ `dsa/network-flow`
- [ ] 27. P vs NP and reductions, intuitively `dsa/p-vs-np`

## System design — 0/18

**Foundations**

- [ ] 1. Client–server and what happens when you type a URL — _packet's journey_ `sysdesign/client-server`
- [ ] 2. Latency numbers every engineer should know — _zoomable timeline_ `sysdesign/latency-numbers`
- [ ] 3. Vertical vs horizontal scaling `sysdesign/scaling`
- [ ] 4. Load balancing algorithms — _requests flowing to servers live_ `sysdesign/load-balancing`
- [ ] 5. Caching: strategies, eviction (LRU/LFU), invalidation — _hit-rate meter_ `sysdesign/caching`
- [ ] 6. CDNs `sysdesign/cdns`

**Data at scale**

- [ ] 7. Databases: SQL vs NoSQL, indexes — _B-tree index lookup_ `sysdesign/databases`
- [ ] 8. Replication: leader–follower, multi-leader — _replication lag visualized_ `sysdesign/replication`
- [ ] 9. Sharding and partitioning — _hot shard problem_ `sysdesign/sharding`
- [ ] 10. Consistent hashing — _the ring, adding/removing nodes_ `sysdesign/consistent-hashing`
- [ ] 11. CAP theorem and consistency models — _partition the network yourself_ `sysdesign/cap`

**Distributed systems**

- [ ] 12. Message queues and pub/sub; backpressure `sysdesign/queues`
- [ ] 13. Rate limiting: token bucket, leaky bucket, sliding window `sysdesign/rate-limiting`
- [ ] 14. Consensus: Raft — _leader election and log replication simulator_ `sysdesign/raft`
- [ ] 15. Idempotency, retries and exactly-once illusions `sysdesign/idempotency`
- [ ] 16. Microservices vs monolith `sysdesign/microservices`
- [ ] 17. Observability: logs, metrics, traces `sysdesign/observability`
- [ ] 18. Case studies: URL shortener, chat, news feed, rate limiter, video, dispatch, KV store — _stress each architecture with traffic_ `sysdesign/case-studies`

## Computer systems — 0/11

**Hardware and the OS**

- [ ] 1. How a CPU runs code: fetch–decode–execute — _tiny visible CPU_ `systems/cpu`
- [ ] 2. Memory hierarchy and caches — _cache lines lighting up_ `systems/memory-hierarchy`
- [ ] 3. Processes, threads and context switching `systems/processes-threads`
- [ ] 4. CPU scheduling algorithms — _Gantt charts_ `systems/scheduling`
- [ ] 5. Concurrency: race conditions, locks, deadlock — _dining philosophers_ `systems/concurrency`
- [ ] 6. Virtual memory and paging — _page table walk_ `systems/virtual-memory`
- [ ] 7. File systems `systems/file-systems`

**Networks**

- [ ] 8. Networking layers; TCP handshake and congestion control — _sawtooth window_ `systems/tcp`
- [ ] 9. DNS and HTTP/HTTPS, TLS handshake `systems/dns-http-tls`

**Databases**

- [ ] 10. Transactions, ACID and isolation levels — _anomalies replayed_ `systems/transactions`
- [ ] 11. Query planning and joins `systems/query-planning`

## Machine learning — 0/18

**Learning from data**

- [ ] 1. What learning from data means; train/test split `ml/what-is-learning`
- [ ] 2. Linear regression and the loss landscape — _drag the line, watch loss_ `ml/linear-regression`
- [ ] 3. Gradient descent — _ball rolling on the loss surface; learning-rate slider_ `ml/gradient-descent`
- [ ] 4. Logistic regression and decision boundaries `ml/logistic-regression`
- [ ] 5. Overfitting, underfitting and bias–variance — _polynomial degree slider_ `ml/bias-variance`
- [ ] 6. Regularization: L1 vs L2 — _diamond vs circle constraints_ `ml/regularization`
- [ ] 7. Cross-validation `ml/cross-validation`

**Classic models**

- [ ] 8. k-nearest neighbors — _Voronoi regions_ `ml/knn`
- [ ] 9. Decision trees — _split the plane_ `ml/decision-trees`
- [ ] 10. Ensembles: random forests and gradient boosting — _weak learners adding up_ `ml/ensembles`
- [ ] 11. Support vector machines and the kernel trick — _lift points into 3D_ `ml/svm`
- [ ] 12. Naive Bayes `ml/naive-bayes`

**Unsupervised learning**

- [ ] 13. k-means and clustering — _centroids marching_ `ml/k-means`
- [ ] 14. Gaussian mixture models and EM `ml/gmm-em`
- [ ] 15. PCA, t-SNE and UMAP `ml/dim-reduction`

**Practice**

- [ ] 16. Evaluation metrics: precision, recall, ROC, AUC — _threshold slider_ `ml/metrics`
- [ ] 17. Feature engineering and data leakage `ml/features-leakage`
- [ ] 18. Intro to reinforcement learning: bandits, MDPs, Q-learning — _grid-world agent_ `ml/intro-rl`

## Deep learning — 0/22

**Neural network basics**

- [ ] 1. The perceptron and why one neuron isn't enough — _XOR_ `dl/perceptron`
- [ ] 2. Multilayer perceptrons: folding space — _watch layers warp the plane_ `dl/mlp`
- [ ] 3. Activation functions `dl/activations`
- [ ] 4. Backpropagation as the chain rule on a graph — _step-through computation graph_ `dl/backprop`
- [ ] 5. Loss functions `dl/losses`

**Training well**

- [ ] 6. Optimizers: SGD, momentum, RMSProp, Adam — _race on a nasty surface_ `dl/optimizers`
- [ ] 7. Initialization, vanishing/exploding gradients `dl/initialization`
- [ ] 8. Batch norm, layer norm `dl/normalization`
- [ ] 9. Dropout and regularization `dl/dropout`

**Architectures**

- [ ] 10. Convolutions — _kernel sliding over an image you draw_ `dl/convolutions`
- [ ] 11. CNN architectures and receptive fields; what filters learn `dl/cnns`
- [ ] 12. ResNets and skip connections `dl/resnets`
- [ ] 13. RNNs, LSTMs and GRUs — _memory over time_ `dl/rnns`
- [ ] 14. Embeddings — _word vectors in 2D/3D_ `dl/embeddings`
- [ ] 15. Attention — _query–key–value as soft lookup_ `dl/attention`
- [ ] 16. Transformers block by block `dl/transformers`

**Generative models and scale**

- [ ] 17. Autoencoders and the latent space `dl/autoencoders`
- [ ] 18. Variational autoencoders — _walk the latent space_ `dl/vaes`
- [ ] 19. GANs — _generator vs discriminator tug of war_ `dl/gans`
- [ ] 20. U-Nets `dl/unets`
- [ ] 21. Training at scale: batching, mixed precision, data/model parallelism `dl/scale`
- [ ] 22. Interpretability basics: saliency, probing, features `dl/interpretability`

## Diffusion models — 0/13

**Noise and denoising**

- [ ] 1. Generative modeling: learning a distribution — _2D toy datasets_ `diffusion/generative-modeling`
- [ ] 2. Adding noise: the forward process — _a spiral dissolving into a Gaussian blob_ `diffusion/forward-process`
- [ ] 3. Noise schedules — _linear vs cosine_ `diffusion/noise-schedules`
- [ ] 4. Learning to denoise: the reverse process — _step back from noise_ `diffusion/reverse-process`
- [ ] 5. Score functions and score matching — _arrows pointing toward data_ `diffusion/score-matching`
- [ ] 6. DDPM, step by step, with a tiny model trained live on 2D data `diffusion/ddpm`

**Sampling and conditioning**

- [ ] 7. DDIM and faster sampling `diffusion/ddim`
- [ ] 8. The SDE/ODE view; probability flow `diffusion/sde-ode`
- [ ] 9. Conditioning and classifier-free guidance — _guidance-scale slider_ `diffusion/guidance`
- [ ] 10. Latent diffusion: diffusing in a VAE's latent space `diffusion/latent-diffusion`
- [ ] 11. Text-to-image pipeline anatomy: text encoder, U-Net/DiT, cross-attention `diffusion/text-to-image`

**Beyond DDPM**

- [ ] 12. Flow matching and rectified flow — _straightening the paths_ `diffusion/flow-matching`
- [ ] 13. Consistency models and distillation `diffusion/consistency-models`

## Large language models — 0/20

**Inside the model**

- [ ] 1. Language modeling as next-token prediction — _predict-the-next-word game_ `llm/next-token`
- [ ] 2. Tokenization and BPE — _watch merges build a vocabulary_ `llm/tokenization`
- [ ] 3. Embeddings and positional encodings — _rotary embeddings as rotations_ `llm/positional`
- [ ] 4. Self-attention, in full detail — _attention matrix you can probe_ `llm/self-attention`
- [ ] 5. Multi-head attention `llm/multi-head`
- [ ] 6. The transformer decoder, assembled — _data flowing through each block_ `llm/decoder`

**Training and inference**

- [ ] 7. Training: cross-entropy, batching, learning-rate schedules `llm/training`
- [ ] 8. Scaling laws — _loss vs compute curves_ `llm/scaling-laws`
- [ ] 9. Sampling: greedy, temperature, top-k, top-p — _same prompt, different dice_ `llm/sampling`
- [ ] 10. The KV cache and inference cost `llm/kv-cache`

**Adapting models**

- [ ] 11. Fine-tuning and instruction tuning `llm/fine-tuning`
- [ ] 12. RLHF and preference optimization (DPO) intuition `llm/rlhf-dpo`
- [ ] 13. LoRA and parameter-efficient fine-tuning — _low-rank update as a thin matrix_ `llm/lora`
- [ ] 14. Quantization — _precision slider vs quality_ `llm/quantization`

**Systems around the model**

- [ ] 15. Retrieval-augmented generation — _embedding search in 2D_ `llm/rag`
- [ ] 16. Tool use and agents: the loop `llm/agents`
- [ ] 17. Mixture of experts — _router choosing experts per token_ `llm/moe`
- [ ] 18. Long context: attention variants and positional extrapolation `llm/long-context`
- [ ] 19. Evaluation and failure modes: hallucination, prompt injection `llm/evaluation`
- [ ] 20. A tiny GPT trained in your browser, end to end (capstone) `llm/tiny-gpt`

## Physics 1: mechanics — 0/20

**Motion**

- [ ] 1. Units, vectors and measurement `phys1/units-vectors`
- [ ] 2. Kinematics in 1D: position, velocity, acceleration graphs linked — _drive the car_ `phys1/kinematics`
- [ ] 3. Projectile motion — _cannon with angle/speed; the dotted trajectory_ `phys1/projectiles`

**Forces**

- [ ] 4. Newton's laws and free-body diagrams — _build the FBD by dragging forces_ `phys1/newtons-laws`
- [ ] 5. Friction and inclined planes `phys1/friction`
- [ ] 6. Circular motion and centripetal force `phys1/circular-motion`

**Energy and momentum**

- [ ] 7. Work, kinetic and potential energy — _roller coaster energy bars_ `phys1/work-energy`
- [ ] 8. Conservation of energy `phys1/conservation-of-energy`
- [ ] 9. Momentum, impulse and collisions — _elastic vs inelastic air track_ `phys1/momentum`
- [ ] 10. Center of mass `phys1/center-of-mass`

**Rotation and gravity**

- [ ] 11. Rotational kinematics and torque — _seesaw, wrench_ `phys1/torque`
- [ ] 12. Moment of inertia and rolling — _race shapes down a ramp_ `phys1/moment-of-inertia`
- [ ] 13. Angular momentum — _spinning skater_ `phys1/angular-momentum`
- [ ] 14. Gravitation and orbits; Kepler's laws — _launch satellites_ `phys1/orbits`

**Oscillations, waves and heat**

- [ ] 15. Simple harmonic motion and pendulums `phys1/shm`
- [ ] 16. Waves: wavelength, frequency, superposition — _two sources interfering_ `phys1/waves`
- [ ] 17. Standing waves and sound — _string harmonics you hear_ `phys1/standing-waves`
- [ ] 18. Fluids: pressure, buoyancy, Bernoulli `phys1/fluids`
- [ ] 19. Thermodynamics: temperature, heat, ideal gas — _box of bouncing particles_ `phys1/ideal-gas`
- [ ] 20. Laws of thermodynamics, heat engines and entropy — _PV diagram cycles_ `phys1/thermo-laws`

## Physics 2: electricity and magnetism — 0/18

**Electrostatics**

- [ ] 1. Electric charge and Coulomb's law — _drag charges, read forces_ `phys2/coulomb`
- [ ] 2. Electric fields and field lines `phys2/electric-fields`
- [ ] 3. Gauss's law — _flux through a surface you resize_ `phys2/gauss`
- [ ] 4. Electric potential and equipotentials — _3D potential landscape_ `phys2/potential`
- [ ] 5. Capacitance and dielectrics `phys2/capacitance`

**Circuits**

- [ ] 6. Current, resistance and Ohm's law — _electron drift_ `phys2/ohms-law`
- [ ] 7. DC circuits: Kirchhoff's laws — _build circuits, see current flow_ `phys2/kirchhoff`
- [ ] 8. RC circuits — _charging curve_ `phys2/rc-circuits`

**Magnetism**

- [ ] 9. Magnetic fields and forces on charges — _cyclotron spirals_ `phys2/magnetic-force`
- [ ] 10. Biot–Savart and Ampère's law — _field around wires and loops_ `phys2/biot-savart`
- [ ] 11. Faraday's law and induction — _magnet through a coil; generator_ `phys2/faraday`
- [ ] 12. Lenz's law `phys2/lenz`
- [ ] 13. Inductance, RL and LC circuits — _energy sloshing between L and C_ `phys2/inductance`
- [ ] 14. AC circuits and resonance; phasors — _rotating arrows_ `phys2/ac-circuits`

**Light**

- [ ] 15. Maxwell's equations together — _one interactive per equation_ `phys2/maxwell`
- [ ] 16. Electromagnetic waves — _E and B in step_ `phys2/em-waves`
- [ ] 17. Geometric optics: reflection, refraction, lenses — _ray-tracing bench_ `phys2/geometric-optics`
- [ ] 18. Wave optics: interference and diffraction — _double slit_ `phys2/wave-optics`

## Beyond (later expansion) — 0/21

**Modern physics**

- [ ] 1. Special relativity — _light clocks, Minkowski diagrams_ `beyond/relativity`
- [ ] 2. The photoelectric effect `beyond/photoelectric`
- [ ] 3. The Bohr model `beyond/bohr-model`
- [ ] 4. Intro quantum mechanics — _wavefunction in a box, tunneling_ `beyond/quantum-intro`

**Signals and systems**

- [ ] 5. Fourier series and transform — _epicycles_ `beyond/fourier`
- [ ] 6. Sampling and aliasing `beyond/sampling-aliasing`
- [ ] 7. Convolution `beyond/convolution`
- [ ] 8. Filters `beyond/filters`

**Numerics and optimization**

- [ ] 9. Information theory `beyond/information-theory`
- [ ] 10. Numerical methods `beyond/numerical-methods`
- [ ] 11. Optimization: convex and constrained `beyond/optimization`

**Graphics**

- [ ] 12. Rasterization `beyond/rasterization`
- [ ] 13. Ray tracing `beyond/ray-tracing`
- [ ] 14. Shaders `beyond/shaders`

**Deep reinforcement learning**

- [ ] 15. Policy gradients `beyond/policy-gradients`
- [ ] 16. PPO `beyond/ppo`
- [ ] 17. AlphaZero-style search `beyond/alphazero`

**Compilers and cryptography**

- [ ] 18. Compilers: lexing, parsing, ASTs `beyond/compilers`
- [ ] 19. Cryptographic hashing `beyond/hashing`
- [ ] 20. Public-key cryptography `beyond/public-key`
- [ ] 21. Zero-knowledge intuition `beyond/zero-knowledge`

<!-- progress:end -->
