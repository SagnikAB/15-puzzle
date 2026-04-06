# 🧩 15 Puzzle Solver (A* Algorithm)

A modern, high-performance **15-puzzle (4×4)** solver built using **A\*** search with Manhattan Distance heuristic.  
Designed with a sleek UI and optimized solving using **Web Workers** for smooth performance.

---

## 🚀 Live Demo
🔗 https://15-puzzle-livid.vercel.app

---

## ✨ Features

- ⚡ A* Search Algorithm (Manhattan Distance heuristic)
- 🧠 Efficient solving with optimized state expansion
- 🔄 Web Worker integration (non-blocking UI)
- 🎨 Modern UI (React + Tailwind + Glassmorphism)
- 🌌 Three.js background effects
- 📊 Handles hard puzzles with higher expansion limits
- 🔒 Uses closed set to avoid repeated states

---

## 🧠 Algorithm Overview

The solver uses:

A* = Best-first search  

f(n) = g(n) + h(n)

Where:
- g(n) = cost to reach current state  
- h(n) = Manhattan distance heuristic  

---

## 🛠️ Tech Stack

- React (Vite)
- Tailwind CSS
- TypeScript
- Web Workers
- Three.js

---

## 📂 Project Structure

```
15-puzzle/
│── public/
│── src/
│   ├── components/
│   ├── solver/
│   ├── worker/
│   ├── styles/
│   └── main.tsx
│
│── index.html
│── package.json
│── tsconfig.json
│── vite.config.ts
```

---

## ⚙️ Installation & Setup

```bash
# Clone the repo
git clone https://github.com/your-username/15-puzzle.git

# Go into folder
cd 15-puzzle

# Install dependencies
npm install

# Run locally
npm run dev
```

---

## 🧪 How It Works

1. User shuffles the puzzle  
2. Solver runs inside a Web Worker  
3. A* explores possible states  
4. Best path is calculated  
5. Solution is animated on UI  

---

## 📈 Performance Optimizations

- Closed set (visited states tracking)
- Increased expansion limits for tough puzzles
- Background processing via Web Workers
- Lazy-loaded visual components

---

## 🎯 Future Improvements

- Add multiple heuristics (Linear Conflict, etc.)
- Manual play mode
- Step-by-step visualization
- Mobile optimization
- IDA* algorithm support

---

## 👤 Author

**Sagnik Dam**

---

## ⭐ Support

If you like this project:

- Star the repo  
- Fork it  
- Contribute improvements  

---

## 📜 License

This project is licensed under the MIT License
