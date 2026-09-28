# CyberON 2026 — Flappy Flag Game

A small Flask-hosted Flappy Bird-style game with a terminal boot animation, mobile-friendly controls, and the event flag shown in the page footer.

## Run locally

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

## Project structure

```text
flappy_flag_game/
├── app.py
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── game.js
    └── style.css
```

The game uses Canvas and CSS-generated visuals, so no external image/audio assets are required.
