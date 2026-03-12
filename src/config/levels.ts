import type { LevelDefinition, ServerContext, LevelHandlerResult } from '../level-handlers/base-handler';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const levels: LevelDefinition[] = [
  {
    id: 1,
    type: 'static',
    title: 'Wachtend op spelers...',
    description:
      'Welkom bij DevCity! We wachten nog even op meer spelers om zich aan te sluiten. Zodra iedereen klaar is, zal de leraar het eerste level starten en kunnen jullie samen op avontuur gaan!',
    rewards: ['welcome_badge'],
  },
  {
    id: 2,
    type: 'click_button',
    title: 'Introductie tot DevCity',
    description:
      'Welcome in DevCity. Als opwarmertje, klik simpelweg op de knop om je eerste beloningen te verdienen en klaar te zijn voor het avontuur dat voor je ligt!',
    rewards: ['bronze_medal'],
    handlerConfig: {
      buttonLabel: 'Ik ben klaar!',
      behavior: 'none',
    },
    renderHtml(cfg: Record<string, unknown>): string {
      const label = escapeHtml(String(cfg.buttonLabel ?? 'Click Me!'));
      return `
        <div class="level-interaction-panel" x-data="clickButtonLevel(${this.id})">
          <div class="click-button-wrapper">
            <button id="level-action-btn" class="btn btn-secondary"
                    style="width:auto; padding: 14px 32px; font-size:1.1em;"
                    @click="submit()">
              ${label}
            </button>
          </div>
          <div id="interaction-feedback" class="answer-feedback"></div>
        </div>
      `;
    },
  },
  {
    id: 3,
    type: 'click_button',
    title: 'DevCity kan verrassend zijn',
    description:
      'Klik maar eens op de knop... maar wees voorbereid, deze kan een beetje ondeugend zijn! Zoek de juiste manier om de knop te vangen en verdien je beloningen.',
    rewards: ['book_icon', 'community_star'],
    handlerConfig: {
      buttonLabel: 'Easy? Think again!',
      behavior: 'dodge',
    },
    renderHtml(cfg: Record<string, unknown>): string {
      const label = escapeHtml(String(cfg.buttonLabel ?? 'Click Me!'));
      return `
        <div class="level-interaction-panel" x-data="clickButtonLevel(${this.id})">
          <div class="click-button-wrapper">
            <button id="level-action-btn" class="btn btn-secondary"
                    style="width:auto; padding: 14px 32px; font-size:1.1em;"
                    @click="submit()">
              ${label}
            </button>
          </div>
          <div id="interaction-feedback" class="answer-feedback"></div>
        </div>
      `;
    },
  },
  {
    id: 4,
    type: 'open_input',
    title: 'Wie speelt er mee?',
    description:
      "Verzamel de namen van 5% van de spelers die nu mee doen! Scheid de namen met komma's.",
    rewards: ['blueprint_scroll', 'creativity_badge'],
    handlerConfig: {
      prompt: "Voer de namen van 5% van de spelers in, gescheiden door komma's.",
      placeholder: 'Speler1, Speler2, Speler3, ...',
    },
    validate(submission: unknown, context: ServerContext): LevelHandlerResult {
      const answer = String((submission as Record<string, unknown>).answer ?? '').trim();
      const room = context.db.getRoomByCode(context.roomCode);
      if (!room) return { success: false, message: 'Kamer niet gevonden.' };

      const students = context.db.getStudentsByRoom(room.id);
      const entered = answer
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const matched = students.filter((s) => entered.includes(s.name.toLowerCase()));
      const requiredCount = Math.ceil(students.length * 0.05);

      if (matched.length >= requiredCount) return { success: true };
      return {
        success: false,
        message: `Je hebt ${matched.length} van de ${requiredCount} benodigde medespelers gevonden. Probeer opnieuw!`,
      };
    },
    renderHtml(cfg: Record<string, unknown>): string {
      const prompt = escapeHtml(String(cfg.prompt ?? 'Enter your answer:'));
      const placeholder = escapeHtml(String(cfg.placeholder ?? ''));
      return `
        <div class="level-interaction-panel" x-data="openInputLevel(${this.id})">
          <div class="open-input-prompt">${prompt}</div>
          <textarea id="open-input-answer" class="open-input-field"
                    placeholder="${placeholder}" x-model="answer"></textarea>
          <div id="interaction-feedback" class="answer-feedback"></div>
          <button class="btn" @click="submit()">Submit Answer</button>
        </div>
      `;
    },
  },
  {
    id: 5,
    type: 'sync_hold',
    title: 'De grote synchronisatie!',
    description:
      'Jullie staan voor de ultieme teamtest! Élke speler in de kamer moet tegelijkertijd de knop ingedrukt houden. Coördineer met je klasgenoten — pas als iedereen klaarstaat, worden jullie allemaal tegelijk beloond!',
    dynamicRewards(context: ServerContext): string[] {
      const room = context.db.getRoomByCode(context.roomCode);
      if (!room) return ['sync_badge', 'team_gem', 'puzzle_piece_1'];
      const students = context.db.getStudentsByRoom(room.id);
      const idx = students.findIndex(s => s.id === context.studentId);
      const piece = ((idx >= 0 ? idx : 0) % 9) + 1;
      return ['sync_badge', 'team_gem', `puzzle_piece_${piece}`];
    },
    handlerConfig: {
      buttonLabel: 'Houd vast!',
      holdDurationMs: 2000,
    },
    renderHtml(cfg: Record<string, unknown>): string {
      const label = escapeHtml(String(cfg.buttonLabel ?? 'Houd vast!'));
      const duration = Number(cfg.holdDurationMs ?? 1000);
      return `
        <div class="level-interaction-panel" x-data="syncHoldLevel(${this.id})">
          <p class="open-input-prompt">Hou samen met <strong>alle spelers</strong> de knop ingedrukt voor ${(duration / 1000).toFixed(1)} seconden!</p>
          <div id="hold-status" class="answer-feedback" style="margin-bottom:12px;"></div>
          <div class="click-button-wrapper">
            <button id="level-action-btn" class="btn btn-secondary"
                    style="width:auto; padding: 18px 40px; font-size:1.2em; user-select:none;"
                    @mousedown.prevent="startHold()"
                    @touchstart.prevent="startHold()">
              ${label}
            </button>
          </div>
          <div id="interaction-feedback" class="answer-feedback"></div>
        </div>
      `;
    },
  },
  {
    id: 6,
    type: 'click_button',
    title: 'De knop verstopt zich!',
    description:
      'Je dacht dat level 2 lastig was? Deze knop heeft trucjes geleerd van zijn grote broer. Vang hem als je kunt!',
    rewards: ['team_trophy', 'silver_star'],
    handlerConfig: {
      buttonLabel: 'Pak me dan!',
      behavior: 'dodge',
      injectScript:
        "/* cannot use tab to select it: */(function(){var btn=document.getElementById('level-action-btn');if(btn)btn.setAttribute('tabindex','-1');})()",
    },
    renderHtml(cfg: Record<string, unknown>): string {
      const label = escapeHtml(String(cfg.buttonLabel ?? 'Click Me!'));
      return `
        <div class="level-interaction-panel" x-data="clickButtonLevel(${this.id})">
          <div class="click-button-wrapper">
            <button id="level-action-btn" class="btn btn-secondary"
                    style="width:auto; padding: 14px 32px; font-size:1.1em;"
                    @click="submit()">
              ${label}
            </button>
          </div>
          <div id="interaction-feedback" class="answer-feedback"></div>
        </div>
      `;
    },
  },
  {
    id: 7,
    type: 'multiple_choice',
    title: 'DevCity Trivia',
    description: 'Alleen echte DevCity-bewoners weten dit! Bewijs dat jij de stad door en door kent.',
    rewards: ['scholar_scroll', 'gold_star'],
    handlerConfig: {
      question: 'Hoeveel bytes zitten er in één kilobyte (in de informatica)?',
      choices: ['100', '1000', '1024', '2048'],
      correctIndex: 2,
    },
    renderHtml(cfg: Record<string, unknown>): string {
      const question = escapeHtml(String(cfg.question ?? 'Choose the correct answer:'));
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const choicesHtml = (choices as unknown[]).map((c, i) => `
        <label class="mc-choice">
          <input type="radio" name="mc-choice-${this.id}" x-model="selected" value="${i}">
          ${escapeHtml(String(c))}
        </label>
      `).join('');
      return `
        <div class="level-interaction-panel" x-data="multipleChoiceLevel(${this.id})">
          <div class="mc-question">${question}</div>
          <div class="mc-choices">${choicesHtml}</div>
          <div id="interaction-feedback" class="answer-feedback"></div>
          <button class="btn" style="margin-top:16px;" @click="submit()">Submit Answer</button>
        </div>
      `;
    },
  },
  {
    id: 8,
    type: 'communal',
    communal: true,
    roomWide: true,
    title: 'De Grote Puzzel!',
    description:
      'De ultieme teamuitdaging! Zoek alle andere spelers op en combineer jullie puzzelstukken. '
      + 'Teken samen het volledige DevCity-plaatje na op het whiteboard. '
      + 'Zodra iedereen zijn stuk heeft bijgedragen en het plaatje compleet is, geeft de leraar het sein dat jullie klaar zijn!',
    rewards: ['master_badge', 'golden_trophy'],
    renderHtml(_cfg: Record<string, unknown>): string {
      return `
        <div class="level-interaction-panel">
          <p class="open-input-prompt">🧩 Zoek alle medespelers op en teken samen het volledige DevCity-plaatje op het whiteboard!</p>
          <p style="margin-top:12px;color:var(--text-muted);font-size:0.9em;">
            Kijk in je inventaris voor jouw puzzelstuk. Combineer alle stukken met je klasgenoten.
            De leraar markeert dit level als voltooid zodra het plaatje compleet is.
          </p>
        </div>
      `;
    },
  },
];

export default levels;
