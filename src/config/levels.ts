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
    type: 'click_button',
    title: 'Introductie tot DevCity',
    description:
      'Welcome in DevCity. Als opwarmertje, klik simpelweg op de knop om je eerste beloningen te verdienen en klaar te zijn voor het avontuur dat voor je ligt!',
    rewards: ['bronze_medal', 'welcome_badge'],
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
    id: 2,
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
    id: 3,
    type: 'open_input',
    title: 'Wie speelt er mee?',
    description:
      "Verzamel de namen van 5 andere spelers die nu mee doen! Scheid de namen met komma's.",
    rewards: ['blueprint_scroll', 'creativity_badge'],
    handlerConfig: {
      prompt: "Voer de namen van 5 andere spelers in, gescheiden door komma's.",
      placeholder: 'Speler1, Speler2, Speler3, ...',
    },
    validate(submission: unknown, context: ServerContext): LevelHandlerResult {
      const answer = String((submission as Record<string, unknown>).answer ?? '').trim();
      const room = context.db.getRoomByCode(context.roomCode);
      if (!room) return { success: false, message: 'Kamer niet gevonden.' };

      const students = context.db.getStudentsByRoom(room.id);
      // Exclude the submitting student themselves
      const others = students.filter((s) => s.id !== context.studentId);
      const entered = answer
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const matched = others.filter((s) => entered.includes(s.name.toLowerCase()));

      if (matched.length >= 5) return { success: true };
      return {
        success: false,
        message: `Je hebt ${matched.length} van de 5 benodigde medespelers gevonden. Probeer opnieuw!`,
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
    id: 4,
    type: 'sync_hold',
    title: 'De grote synchronisatie!',
    description:
      'Jullie staan voor de ultieme teamtest! Élke speler in de kamer moet tegelijkertijd de knop ingedrukt houden. Coördineer met je klasgenoten — pas als iedereen klaarstaat, worden jullie allemaal tegelijk beloond!',
    rewards: ['sync_badge', 'team_gem'],
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
    id: 5,
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
    id: 6,
    type: 'open_input',
    title: 'De geheime code',
    description:
      'Ergens in DevCity is een geheime code verborgen. Vraag het aan een mede-speler, want zij weten het antwoord... misschien. De code bestaat uit een kleur, een dier en een getal.',
    rewards: ['lightbulb_badge', 'innovator_medal'],
    handlerConfig: {
      prompt: 'Wat is de geheime code? Schrijf een kleur, een dier én een getal op.',
      placeholder: 'Blauw, olifant, 42...',
      validation: { type: 'min_length', length: 5 },
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
    id: 7,
    type: 'static',
    title: 'Bouw je gebouw!',
    description:
      'Werk samen met twee andere spelers om een imaginair gebouw te ontwerpen. Vertel de leraar welk gebouw jullie hebben bedacht en wie je teamgenoten waren om dit level te voltooien!',
    rewards: ['leader_crown', 'helper_heart'],
  },
  {
    id: 8,
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
    id: 9,
    type: 'open_input',
    title: 'Jouw superheldenkracht',
    description:
      'Elke DevCity-held heeft een speciale kracht. Wat is jouw superpower en hoe gebruik je die om DevCity te verbeteren? Wees creatief!',
    rewards: ['eloquence_badge', 'communication_ribbon'],
    handlerConfig: {
      prompt: 'Beschrijf jouw superheldenkracht en hoe je DevCity daarmee verbetert.',
      placeholder: 'Mijn superpower is... Hiermee kan ik DevCity verbeteren door...',
      validation: { type: 'contains_all', keywords: ['superpower', 'devcity'] },
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
    id: 10,
    type: 'click_button',
    title: 'De finale knop',
    description:
      'Dit is de allerlaatste knop van DevCity. Hij is snel, hij is wild, maar jij bent sneller. Vang hem en claim je plek als DevCity-legende!',
    rewards: ['inventor_wrench', 'innovation_trophy'],
    handlerConfig: {
      buttonLabel: 'Ik ben een legende!',
      injectScript:
        "(function(){var btn=document.getElementById('level-action-btn');if(!btn)return;btn.addEventListener('mouseover',function move(){var x=Math.random()*(window.innerWidth-140);var y=Math.random()*(window.innerHeight-60);btn.style.position='fixed';btn.style.left=x+'px';btn.style.top=y+'px';});})();",
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
    id: 11,
    type: 'static',
    title: 'DevCity Meester-Bouwer!',
    description:
      'Gefeliciteerd! Je hebt alle uitdagingen van DevCity doorstaan, nieuwe vrienden gemaakt, codes gekraakt en knoppen gevangen. DevCity kroont jou tot Meester-Bouwer! Laat de leraar weten dat je klaar bent en ontvang je legendarische beloningen.',
    rewards: ['master_badge', 'golden_trophy', 'architect_crown', 'completion_certificate'],
  },
];

export default levels;
