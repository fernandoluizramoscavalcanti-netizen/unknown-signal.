# UNKNOWN SIGNAL (v0.1)
Dedução social multiplayer no navegador. Servidor autoritativo (Node.js + Socket.IO).

## Rodar
1. Instale o Node.js 18+ (nodejs.org).
2. Na pasta do projeto: `npm install` e depois `npm start`.
3. Abra http://localhost:3000. São necessários 3+ jogadores: use várias abas, ou celulares na mesma rede em http://IP-DO-PC:3000.

## Jogar com amigos pela internet
- Rápido: com o servidor rodando, em outro terminal use `npx localtunnel --port 3000` e envie o link gerado.
- Fixo: suba a pasta em Render, Railway ou Fly (start: `npm start`; a porta vem da variável de ambiente `PORT`).

## Controles
PC: WASD/setas, E usa a tarefa, Q mata, R reporta, botão EMERG. na mesa central. Celular: joystick e botões.

## Estrutura
- server.js: backend (salas, mapa, papéis secretos, tarefas, mortes, reuniões, votos, vitória)
- public/index.html: frontend (menu, lobby, jogo em canvas, minijogos, chat)
