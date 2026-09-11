// Leichtgewichtiger Kalender-Popup, der ein <input type="date"> ersetzt.
// input.value bleibt weiterhin ein ISO-String "YYYY-MM-DD" (oder ""), damit
// bestehender Code (new Date(input.value) usw.) unverändert weiterläuft.
(function () {
	const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni",
		"Juli", "August", "September", "Oktober", "November", "Dezember"];
	const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

	function pad(n) { return String(n).padStart(2, "0"); }

	function toISO(date) {
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function parseISO(str) {
		if (!str) return null;
		const parts = str.split("-").map(Number);
		if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
		const [y, m, d] = parts;
		return new Date(y, m - 1, d);
	}

	function closeOpenPicker() {
		const existing = document.querySelector(".dp-popup");
		if (existing) existing.remove();
	}

	function buildPopup(input, options) {
		const popup = document.createElement("div");
		popup.className = "dp-popup";

		const header = document.createElement("div");
		header.className = "dp-header";
		const prevBtn = document.createElement("button");
		prevBtn.type = "button";
		prevBtn.className = "dp-nav";
		prevBtn.innerText = "‹";
		prevBtn.title = "Vorheriger Monat";

		// Monat und Jahr direkt wählbar - sonst müsste man sich für einen
		// Geburtstag Jahrzehnte weit durch die Monatspfeile klicken.
		const monthSel = document.createElement("select");
		monthSel.className = "dp-select dp-month-select";
		MONTH_NAMES.forEach((name, i) => {
			const opt = document.createElement("option");
			opt.value = String(i);
			opt.text = name;
			monthSel.appendChild(opt);
		});

		const yearSel = document.createElement("select");
		yearSel.className = "dp-select dp-year-select";

		const nextBtn = document.createElement("button");
		nextBtn.type = "button";
		nextBtn.className = "dp-nav";
		nextBtn.innerText = "›";
		nextBtn.title = "Nächster Monat";

		header.appendChild(prevBtn);
		header.appendChild(monthSel);
		header.appendChild(yearSel);
		header.appendChild(nextBtn);

		const weekdays = document.createElement("div");
		weekdays.className = "dp-weekdays";
		WEEKDAY_LABELS.forEach((w) => {
			const span = document.createElement("span");
			span.innerText = w;
			weekdays.appendChild(span);
		});

		const grid = document.createElement("div");
		grid.className = "dp-grid";

		const footer = document.createElement("div");
		footer.className = "dp-footer";
		const todayBtn = document.createElement("button");
		todayBtn.type = "button";
		todayBtn.className = "dp-today";
		todayBtn.innerText = "Heute";
		footer.appendChild(todayBtn);
		if (options.allowClear) {
			const clearBtn = document.createElement("button");
			clearBtn.type = "button";
			clearBtn.className = "dp-clear";
			clearBtn.innerText = "Löschen";
			footer.appendChild(clearBtn);
			clearBtn.addEventListener("click", () => {
				input.value = "";
				input.dispatchEvent(new Event("change"));
				closeOpenPicker();
			});
		}

		popup.appendChild(header);
		popup.appendChild(weekdays);
		popup.appendChild(grid);
		popup.appendChild(footer);

		let view = parseISO(input.value) || new Date();
		view = new Date(view.getFullYear(), view.getMonth(), 1);

		function selectDate(date) {
			input.value = toISO(date);
			input.dispatchEvent(new Event("change"));
			closeOpenPicker();
		}

		function renderYearOptions() {
			// Fenster um das angezeigte Jahr; deckt Geburtstage wie zukünftige
			// Termine ab, ohne eine endlose Liste zu erzeugen.
			const current = view.getFullYear();
			const thisYear = new Date().getFullYear();
			const from = Math.min(current, thisYear - 100);
			const to = Math.max(current, thisYear + 10);
			yearSel.innerHTML = "";
			for (let y = to; y >= from; y--) {
				const opt = document.createElement("option");
				opt.value = String(y);
				opt.text = String(y);
				yearSel.appendChild(opt);
			}
			yearSel.value = String(current);
		}

		function render() {
			monthSel.value = String(view.getMonth());
			renderYearOptions();
			grid.innerHTML = "";

			const selected = parseISO(input.value);
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
			// Montag=0 .. Sonntag=6 statt JS-Standard Sonntag=0 .. Samstag=6.
			const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
			const gridStart = new Date(firstOfMonth);
			gridStart.setDate(gridStart.getDate() - leadingBlank);

			for (let i = 0; i < 42; i++) {
				const cellDate = new Date(gridStart);
				cellDate.setDate(gridStart.getDate() + i);

				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "dp-day";
				btn.innerText = String(cellDate.getDate());

				if (cellDate.getMonth() !== view.getMonth()) btn.classList.add("dp-outside");
				if (cellDate.getTime() === today.getTime()) btn.classList.add("dp-today-marker");
				if (selected && cellDate.getTime() === selected.getTime()) btn.classList.add("dp-selected");

				if (options.highlightMap) {
					const status = options.highlightMap[toISO(cellDate)];
					if (status && status !== "none") btn.classList.add("dp-status-" + status);
				}

				btn.addEventListener("click", () => selectDate(cellDate));
				grid.appendChild(btn);
			}
		}

		prevBtn.addEventListener("click", () => {
			view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
			render();
		});
		nextBtn.addEventListener("click", () => {
			view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
			render();
		});
		monthSel.addEventListener("change", () => {
			view = new Date(view.getFullYear(), parseInt(monthSel.value, 10), 1);
			render();
		});
		yearSel.addEventListener("change", () => {
			view = new Date(parseInt(yearSel.value, 10), view.getMonth(), 1);
			render();
		});
		todayBtn.addEventListener("click", () => {
			view = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
			render();
		});

		// Erlaubt es, den Kalender von außen mitziehen zu lassen, während im
		// Eingabefeld getippt wird.
		popup.dpSetView = function (date) {
			view = new Date(date.getFullYear(), date.getMonth(), 1);
			render();
		};

		render();
		return popup;
	}

	function positionPopup(popup, input) {
		document.body.appendChild(popup);
		const rect = input.getBoundingClientRect();
		const popupRect = popup.getBoundingClientRect();

		let top = rect.bottom + 4;
		if (top + popupRect.height > window.innerHeight) {
			top = rect.top - popupRect.height - 4;
		}
		let left = rect.left;
		if (left + popupRect.width > window.innerWidth) {
			left = window.innerWidth - popupRect.width - 8;
		}
		popup.style.top = Math.max(4, top) + "px";
		popup.style.left = Math.max(4, left) + "px";
	}

	function openPicker(input, options) {
		// focus und click feuern beim Anklicken beide - der Kalender darf davon
		// nicht zwei Mal aufgebaut (und die Auswahl zurückgesetzt) werden.
		const open = document.querySelector(".dp-popup");
		if (open && open.dpInput === input) return;

		closeOpenPicker();
		const popup = buildPopup(input, options);
		popup.dpInput = input;
		popup.style.visibility = "hidden";
		positionPopup(popup, input);
		popup.style.visibility = "visible";

		function onOutsideClick(e) {
			if (!popup.contains(e.target) && e.target !== input) {
				cleanup();
			}
		}
		function onEscape(e) {
			if (e.key === "Escape") cleanup();
		}
		function onScroll() {
			cleanup();
		}
		function cleanup() {
			popup.remove();
			document.removeEventListener("mousedown", onOutsideClick, true);
			document.removeEventListener("keydown", onEscape, true);
			window.removeEventListener("resize", onScroll, true);
			document.removeEventListener("scroll", onScroll, true);
		}

		// Klick, der das Popup öffnet, soll es nicht sofort wieder schließen.
		setTimeout(() => {
			document.addEventListener("mousedown", onOutsideClick, true);
			document.addEventListener("keydown", onEscape, true);
			window.addEventListener("resize", onScroll, true);
			document.addEventListener("scroll", onScroll, true);
		}, 0);
	}

	/**
	 * Ersetzt input (type="date" oder type="text") durch einen Kalender-Popup.
	 * input.value bleibt ein ISO-Datumsstring "YYYY-MM-DD" (oder "").
	 * options.highlightMap: { "YYYY-MM-DD": "normal"|"excused"|"absent"|"none" }
	 * options.allowClear: zeigt einen "Löschen"-Button im Popup.
	 */
	window.initDatePicker = function (input, options) {
		options = options || {};
		input.setAttribute("type", "text");
		input.classList.add("dp-input");
		if (!input.placeholder) input.placeholder = "JJJJ-MM-TT";

		input.addEventListener("focus", () => openPicker(input, options));
		input.addEventListener("click", () => openPicker(input, options));

		// Tippen ist ausdrücklich erlaubt. Während getippt wird, folgt der
		// Kalender der Eingabe, sobald sie ein gültiges Datum ergibt.
		input.addEventListener("input", () => {
			const parsed = parseISO(input.value.trim());
			if (parsed && !Number.isNaN(parsed.getTime())) {
				const popup = document.querySelector(".dp-popup");
				if (popup && popup.dpSetView) popup.dpSetView(parsed);
			}
		});

		// Beim Verlassen normalisieren: unbrauchbare Eingaben werden verworfen,
		// damit nie ein kaputter Wert abgeschickt wird.
		input.addEventListener("blur", () => {
			const raw = input.value.trim();
			if (raw === "") return;
			const parsed = parseISO(raw);
			if (parsed && !Number.isNaN(parsed.getTime())) {
				input.value = toISO(parsed);
			} else {
				input.value = "";
			}
		});

		// Erlaubt nachträgliches Aktualisieren der Markierungen (z.B. sobald
		// die Anwesenheitshistorie eines Schülers nachgeladen wurde).
		input.updateDatePickerOptions = function (next) {
			Object.assign(options, next);
		};
	};
})();
