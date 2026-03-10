import type { LevelDefinition, ServerContext, LevelHandlerResult } from '../level-handlers/base-handler';

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
