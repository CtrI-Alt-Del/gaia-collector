document.addEventListener("DOMContentLoaded", () => {
	const stationListDiv = document.getElementById("station-list");
	const startBtn = document.getElementById("start-btn");
	const stopBtn = document.getElementById("stop-btn");
	const selectAllBtn = document.getElementById("select-all-btn");
	const logOutput = document.getElementById("log-output");
	const statusDiv = document.getElementById("status");
	const pluInput = document.getElementById("plu");

	let ws;

	function connectWebSocket() {
		const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
		console.log(`${wsProtocol}//${window.location.host}`);

		ws.onopen = () => {
			console.log("Conexão WebSocket aberta.");
			updateStatus("Conectado e pronto para iniciar.");
			startBtn.disabled = false;
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			if (data.type === "log") {
				logOutput.textContent += data.message + "\n";
				logOutput.scrollTop = logOutput.scrollHeight;
			} else if (data.type === "status" || data.type === "info") {
				updateStatus(data.message);
			}
		};

		ws.onclose = () => {
			console.log(
				"Conexão WebSocket fechada. Tentando reconectar em 3 segundos...",
			);
			updateStatus("Desconectado. Tentando reconectar...", true);
			startBtn.disabled = true;
			stopBtn.disabled = true;
			setTimeout(connectWebSocket, 1000 * 60);
		};

		ws.onerror = (error) => {
			console.error("Erro no WebSocket:", error);
			updateStatus("Erro na conexão.", true);
			startBtn.disabled = true;
			stopBtn.disabled = true;
		};
	}

	function updateStatus(message, isError = false) {
		statusDiv.textContent = `Status: ${message}`;
		if (
			isError ||
			message.includes("Parado") ||
			message.includes("Desconectado")
		) {
			statusDiv.className = "status-stopped";
		} else {
			statusDiv.className = "status-running";
		}
	}

	async function fetchStations() {
		try {
			const response = await fetch("/stations?pageSize=101");
			const body = await response.json();
			const stations = body.items;

			stationListDiv.innerHTML = "";
			stations.forEach((station) => {
				const div = document.createElement("div");
				div.className = "station-item";
				div.innerHTML = `
                    <label>
                        <input type="checkbox" name="station" value="${station.uid}">
                        ${station.name} #${station.uid}
                    </label>
                `;
				stationListDiv.appendChild(div);
			});

			selectAllBtn.disabled = stations.length === 0;
		} catch (error) {
			stationListDiv.innerHTML =
				'<p style="color: red;">Erro ao carregar estações.</p>';
			selectAllBtn.disabled = true;
			console.error("Erro:", error);
		}
	}

	selectAllBtn.addEventListener("click", () => {
		const checkboxes = document.querySelectorAll('input[name="station"]');
		if (checkboxes.length === 0) {
			return;
		}

		checkboxes.forEach((checkbox) => {
			checkbox.checked = true;
		});
	});

	startBtn.addEventListener("click", () => {
		const selectedStations = Array.from(
			document.querySelectorAll('input[name="station"]:checked'),
		).map((cb) => cb.value);

		if (selectedStations.length === 0) {
			alert("Por favor, selecione pelo menos uma estação.");
			return;
		}

		const payloadParams = {
			plu: parseInt(pluInput.value, 10),
		};

		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(
				JSON.stringify({
					action: "start",
					payload: {
						stations: selectedStations,
						params: payloadParams,
					},
				}),
			);

			startBtn.disabled = true;
			stopBtn.disabled = false;
			logOutput.textContent = "";
		} else {
			updateStatus("Conexão não está pronta. Tente novamente.", true);
		}
	});

	stopBtn.addEventListener("click", () => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ action: "stop" }));
		}
		startBtn.disabled = false;
		stopBtn.disabled = true;
	});

	fetchStations();
	connectWebSocket();
});
