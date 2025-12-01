// Votación
const votingSection = document.getElementById('voting-section');
const votingList = document.getElementById('voting-list');
const votingStatus = document.getElementById('voting-status');
// Importa los módulos de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, remove, child, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBCuyxJTFa7fWJxrZ4rRFMk5ycfQaiEMuk",
  authDomain: "impostor-1d813.firebaseapp.com",
  databaseURL: "https://impostor-1d813-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "impostor-1d813",
  storageBucket: "impostor-1d813.firebasestorage.app",
  messagingSenderId: "388991476840",
  appId: "1:388991476840:web:4166fbc6f4a570e96147dd"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Utilidades
function randomRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Estado
let username = "";
let currentRoom = null;
let playerKey = null;
let isLeader = false;
let ready = false;
let timerInterval = null;
let wordsList = [];

// Elementos
const loginSection = document.getElementById('login-section');
const roomSection = document.getElementById('room-section');
const inRoomSection = document.getElementById('in-room-section');
const usernameInput = document.getElementById('username');
const saveUsernameBtn = document.getElementById('save-username');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const roomCodeInput = document.getElementById('room-code-input');
const roomCodeSpan = document.getElementById('room-code');
const playersList = document.getElementById('players-list');

const leaveRoomBtn = document.getElementById('leave-room');
const readyBtn = document.getElementById('ready-btn');
const gameSection = document.getElementById('game-section');
const yourWordSpan = document.getElementById('your-word');
const timerSpan = document.getElementById('timer');

const resetRoomBtn = document.getElementById('reset-room');
// Elementos para adivinanza del impostor
const impostorGuessSection = document.getElementById('impostor-guess-section');
const impostorGuessInput = document.getElementById('impostor-guess-input');
const impostorGuessBtn = document.getElementById('impostor-guess-btn');
const impostorGuessStatus = document.getElementById('impostor-guess-status');

// Cargar palabras desde words.json
fetch('words.json')
  .then(r => r.json())
  .then(words => { wordsList = words; });

// Guardar nombre
saveUsernameBtn.onclick = () => {
  const name = usernameInput.value.trim();
  if (name.length < 2) {
    alert('Pon un nombre válido');
    return;
  }
  username = name;
  loginSection.style.display = 'none';
  roomSection.style.display = '';
};

// Crear sala
createRoomBtn.onclick = async () => {
  let code = randomRoomCode();
  // Verifica que no exista ya la sala
  let exists = await get(ref(db, 'rooms/' + code));
  while (exists.exists()) {
    code = randomRoomCode();
    exists = await get(ref(db, 'rooms/' + code));
  }
  // Crea la sala y mete al usuario, y lo marca como líder
  await set(ref(db, 'rooms/' + code), {
    createdAt: Date.now(),
    leader: username,
    state: 'waiting',
    timer: null,
    word: null,
    impostor: null
  });
  joinRoom(code, true);
};

// Unirse a sala
joinRoomBtn.onclick = async () => {
  const code = roomCodeInput.value.trim();
  if (code.length !== 6 || isNaN(code)) {
    alert('Código inválido');
    return;
  }
  const roomRef = ref(db, 'rooms/' + code);
  const snap = await get(roomRef);
  if (!snap.exists()) {
    alert('La sala no existe');
    return;
  }
  joinRoom(code, false);
};

// Entrar a la sala
async function joinRoom(code, leader = false) {
  currentRoom = code;
  isLeader = leader;
  roomSection.style.display = 'none';
  inRoomSection.style.display = '';
  roomCodeSpan.textContent = code;
  // Agrega usuario a la sala
  const playersRef = ref(db, `rooms/${code}/players`);
  const newPlayerRef = push(playersRef);
  playerKey = newPlayerRef.key;
  await set(newPlayerRef, { name: username, ready: false });
  // Escucha cambios en la sala y votos para mostrar la lista con botones de votar
  function renderPlayersList(playersArr, votes, roomData) {
    playersList.innerHTML = '';
    playersArr.forEach(p => {
      const li = document.createElement('li');
      li.className = 'list-group-item bg-secondary text-light d-flex justify-content-between align-items-center';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name + (p.ready ? ' ✅' : '');
      li.appendChild(nameSpan);
      // Solo mostrar botón de votar durante la partida, si no hay resultado, y no a sí mismo
      if (roomData && roomData.state === 'playing' && !roomData.result && p.key !== playerKey) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-outline-light ms-auto';
        btn.textContent = 'Votar';
        btn.onclick = async () => {
          await set(ref(db, `rooms/${currentRoom}/votes/${playerKey}`), p.key);
        };
        // Si ya votó, deshabilitar
        if (votes && votes[playerKey]) btn.disabled = true;
        li.appendChild(btn);
      }
      playersList.appendChild(li);
    });
  }

  let lastPlayersArr = [];
  let lastVotes = {};
  let lastRoomData = null;

  // Escucha cambios en la sala
  onValue(playersRef, (snapshot) => {
    const playersArr = [];
    snapshot.forEach(child => {
      playersArr.push({ key: child.key, ...child.val() });
    });
    lastPlayersArr = playersArr;
    renderPlayersList(playersArr, lastVotes, lastRoomData);
  });
  // Escucha estado de la sala
  onValue(ref(db, `rooms/${code}`), (snap) => {
    const data = snap.val();
    if (!data) return;
    lastRoomData = data;
    // Mostrar botón de reinicio solo al líder
    if (data.leader === username) {
      resetRoomBtn.style.display = '';
      isLeader = true;
    } else {
      resetRoomBtn.style.display = 'none';
      isLeader = false;
    }
    // Estado de juego
      if (data.result) {
        // Mostrar mensaje de resultado a todos los jugadores y resetear sala
        setTimeout(async () => {
          alert(data.result);
          await update(ref(db, `rooms/${currentRoom}`), {
            state: 'waiting',
            word: null,
            impostor: null,
            timer: null,
            startPlayerName: null,
            impostorGuessed: null,
            result: null
          });
          // Reset ready de todos
          const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
          playersSnap.forEach(child => {
            update(ref(db, `rooms/${currentRoom}/players/${child.key}`), { ready: false });
          });
          // Limpiar votos
          await set(ref(db, `rooms/${currentRoom}/votes`), {});
        }, 300);
        return;
      }
      if (data.state === 'playing') {
      gameSection.style.display = '';
      readyBtn.style.display = 'none';
      // Palabra asignada
      if (data.impostor === playerKey) {
        yourWordSpan.textContent = 'IMPOSTOR';
        // Mostrar sección de adivinanza solo si el impostor no ha intentado aún
        if (!data.impostorGuessed) {
          impostorGuessSection.style.display = '';
          impostorGuessStatus.textContent = '';
          impostorGuessInput.value = '';
          impostorGuessInput.disabled = false;
          impostorGuessBtn.disabled = false;
        } else {
          impostorGuessSection.style.display = 'none';
        }
      } else {
        yourWordSpan.textContent = data.word;
        impostorGuessSection.style.display = 'none';
      }
      // Mostrar quién empieza
      const startPlayerSpan = document.getElementById('start-player');
      if (startPlayerSpan) {
        if (data.startPlayerName) {
          startPlayerSpan.textContent = `Empieza ${data.startPlayerName}`;
          startPlayerSpan.style.display = '';
        } else {
          startPlayerSpan.textContent = '';
          startPlayerSpan.style.display = 'none';
        }
      }
      // Temporizador
      if (data.timer) {
        startTimer(data.timer);
      }
    } else {
      gameSection.style.display = 'none';
      impostorGuessSection.style.display = 'none';
      // Ocultar texto de quién empieza
      const startPlayerSpan = document.getElementById('start-player');
      if (startPlayerSpan) {
        startPlayerSpan.textContent = '';
        startPlayerSpan.style.display = 'none';
      }
      // Solo el líder ve el botón Listo
      if (data.leader === username) {
        readyBtn.style.display = '';
      } else {
        readyBtn.style.display = 'none';
      }
      yourWordSpan.textContent = '';
      stopTimer();
    }
      // Adivinanza del impostor
      if (impostorGuessBtn) {
        impostorGuessBtn.onclick = async () => {
          const guess = impostorGuessInput.value.trim().toLowerCase();
          if (!guess) return;
          impostorGuessInput.disabled = true;
          impostorGuessBtn.disabled = true;
          // Obtener la palabra real
          const roomSnap = await get(ref(db, `rooms/${currentRoom}`));
          const roomData = roomSnap.val();
          if (!roomData || !roomData.word) return;
          const realWord = roomData.word.toLowerCase();
          // Solo puede intentar una vez
          await update(ref(db, `rooms/${currentRoom}`), { impostorGuessed: true });
          if (guess === realWord) {
            // El impostor gana directamente, guardar mensaje en la sala para que todos lo vean
            // Obtener nombre del impostor
            let impostorName = username;
            // Intentar obtener el nombre real del impostor desde la lista de jugadores
            const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
            playersSnap.forEach(child => {
              if (child.key === playerKey) {
                impostorName = child.val().name;
              }
            });
            const winMsg = `¡El impostor (${impostorName}) ha adivinado la palabra y gana la partida!`;
            await update(ref(db, `rooms/${currentRoom}`), { result: winMsg });
          } else {
            impostorGuessStatus.textContent = 'Incorrecto. Puedes seguir jugando, pero ya no puedes volver a intentar.';
          }
        };
      }
    // Renderizar lista de jugadores con votos
    renderPlayersList(lastPlayersArr, lastVotes, data);
  });

  // Escuchar votos en tiempo real para actualizar la UI y resolver votación
  onValue(ref(db, `rooms/${code}/votes`), (snap) => {
    const votes = snap.exists() ? snap.val() : {};
    lastVotes = votes;
    renderPlayersList(lastPlayersArr, votes, lastRoomData);
    // Resolver votación si todos votaron y estamos en partida
    if (lastRoomData && lastRoomData.state === 'playing' && !lastRoomData.result) {
      get(ref(db, `rooms/${code}/players`)).then(playersSnap => {
        const players = [];
        playersSnap.forEach(child => {
          players.push({ key: child.key, ...child.val() });
        });
        const totalVotes = Object.keys(votes).length;
        if (totalVotes === players.length) {
          resolveVoting(players, votes, lastRoomData);
        }
      });
    }
  });
// (Eliminada función showVoting, ahora la lista principal tiene los botones)

// Resolver votación
async function resolveVoting(players, votes, roomData) {
  // Contar votos
  const voteCount = {};
  Object.values(votes).forEach(votedKey => {
    voteCount[votedKey] = (voteCount[votedKey] || 0) + 1;
  });
  // Buscar el más votado y si hay empate
  let expelledKey = null;
  let maxVotes = 0;
  let empate = false;
  for (const key in voteCount) {
    if (voteCount[key] > maxVotes) {
      maxVotes = voteCount[key];
      expelledKey = key;
      empate = false;
    } else if (voteCount[key] === maxVotes && maxVotes > 0) {
      empate = true;
    }
  }
  // Si empate o nadie tiene votos
  if (empate || !expelledKey) {
    alert('¡Empate en la votación! Vuelvan a votar.');
    // Limpiar votos para permitir volver a votar
    await set(ref(db, `rooms/${currentRoom}/votes`), {});
    return;
  }
  // Marcar resultado en la sala
  const expelledPlayer = players.find(p => p.key === expelledKey);
  if (!expelledPlayer) return;
  let resultMsg = '';
  if (expelledKey === roomData.impostor) {
    resultMsg = `¡Han expulsado al impostor (${expelledPlayer.name})! Los inocentes ganan.`;
  } else {
    // Buscar el nombre del impostor
    const impostorPlayer = players.find(p => p.key === roomData.impostor);
    const impostorName = impostorPlayer ? impostorPlayer.name : 'el impostor';
    resultMsg = `¡Han expulsado a un inocente (${expelledPlayer.name})! El impostor (${impostorName}) gana.`;
  }
  // Mostrar alerta y reiniciar sala
  setTimeout(async () => {
    alert(resultMsg);
    // Reset sala igual que el botón de reinicio
    await update(ref(db, `rooms/${currentRoom}`), {
      state: 'waiting',
      word: null,
      impostor: null,
      timer: null,
      startPlayerName: null,
      impostorGuessed: null
    });
    // Reset ready de todos
    const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
    playersSnap.forEach(child => {
      update(ref(db, `rooms/${currentRoom}/players/${child.key}`), { ready: false });
    });
    // Limpiar votos
    await set(ref(db, `rooms/${currentRoom}/votes`), {});
  }, 300);
}
}

// Salir de la sala
leaveRoomBtn.onclick = async () => {
  if (currentRoom && playerKey) {
    await remove(ref(db, `rooms/${currentRoom}/players/${playerKey}`));
    // Si la sala queda vacía, bórrala
    const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
    if (!playersSnap.exists()) {
      await remove(ref(db, `rooms/${currentRoom}`));
    }
  }
  currentRoom = null;
  playerKey = null;
  inRoomSection.style.display = 'none';
  roomSection.style.display = '';
  stopTimer();
};

// Si recarga, salir de la sala
window.addEventListener('beforeunload', async (e) => {
  if (currentRoom && playerKey) {
    await remove(ref(db, `rooms/${currentRoom}/players/${playerKey}`));
    const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
    if (!playersSnap.exists()) {
      await remove(ref(db, `rooms/${currentRoom}`));
    }
  }
});

// Botón Listo (solo líder puede iniciar)
readyBtn.onclick = async () => {
  if (!currentRoom || !playerKey || !isLeader) return;
  // Marca al líder como listo (opcional, para mostrar el check)
  await update(ref(db, `rooms/${currentRoom}/players/${playerKey}`), { ready: true });
  // Obtiene todos los jugadores
  const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
  const players = [];
  playersSnap.forEach(child => {
    players.push({ key: child.key, ...child.val() });
  });
  if (players.length > 1) {
    startGame(players);
  } else {
    alert('Se necesitan al menos 2 jugadores.');


  }
};

// Iniciar juego: asignar palabra e impostor, poner timer y jugador que empieza
async function startGame(players) {
  // Elegir palabra aleatoria
  const word = wordsList[Math.floor(Math.random() * wordsList.length)];
  // Elegir impostor
  const impostorIndex = Math.floor(Math.random() * players.length);
  const impostorKey = players[impostorIndex].key;
  // Elegir jugador que empieza
  const startPlayerIndex = Math.floor(Math.random() * players.length);
  const startPlayerName = players[startPlayerIndex].name;
  // Timer: 7 minutos desde ahora
  const timerEnd = Date.now() + 7 * 60 * 1000;
  await update(ref(db, `rooms/${currentRoom}`), {
    state: 'playing',
    word: word,
    impostor: impostorKey,
    timer: timerEnd,
    startPlayerName: startPlayerName
  });
  // Reset ready
  for (const p of players) {
    await update(ref(db, `rooms/${currentRoom}/players/${p.key}`), { ready: false });
  }
}

// Temporizador
function startTimer(endTime) {
  stopTimer();
  async function handleTimeout() {
    // Obtener datos de la sala para saber el impostor
    const roomSnap = await get(ref(db, `rooms/${currentRoom}`));
    const roomData = roomSnap.val();
    if (!roomData || roomData.state !== 'playing' || roomData.result) return;
    // Obtener nombre del impostor
    let impostorName = 'el impostor';
    if (roomData.impostor && roomData.players && roomData.players[roomData.impostor]) {
      impostorName = roomData.players[roomData.impostor].name;
    } else {
      // Buscar en la lista de jugadores si existe
      const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
      playersSnap.forEach(child => {
        if (child.key === roomData.impostor) {
          impostorName = child.val().name;
        }
      });
    }
    const empateMsg = `¡Tiempo terminado! La partida queda en empate. El impostor era ${impostorName}.`;
    await update(ref(db, `rooms/${currentRoom}`), { result: empateMsg });
  }
  function updateTimer() {
    const now = Date.now();
    let diff = Math.max(0, endTime - now);
    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    timerSpan.textContent = `Tiempo restante: ${min}:${sec.toString().padStart(2, '0')}`;
    if (diff <= 0) {
      stopTimer();
      timerSpan.textContent = '¡Tiempo terminado!';
      handleTimeout();
    }
  }
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerSpan.textContent = '';
}

// Botón de reinicio (solo líder)
resetRoomBtn.onclick = async () => {
  if (!isLeader || !currentRoom) return;
  // Reset sala
  await update(ref(db, `rooms/${currentRoom}`), {
    state: 'waiting',
    word: null,
    impostor: null,
    timer: null,
    startPlayerName: null,
    impostorGuessed: null
  });
  // Reset ready de todos
  const playersSnap = await get(ref(db, `rooms/${currentRoom}/players`));
  playersSnap.forEach(child => {
    update(ref(db, `rooms/${currentRoom}/players/${child.key}`), { ready: false });
  });
  // Limpiar votos
  await set(ref(db, `rooms/${currentRoom}/votes`), {});
};