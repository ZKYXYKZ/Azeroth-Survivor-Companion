const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "AS-Companion", "web", "data.json"), "utf8"));
const out = path.join(__dirname, "..", "AS-Companion", "web", "defaults.json");

const RULES = "50,0,1,3,20,2,1";
const T = (s) => Object.fromEntries(s.trim().split(/\s+/).map((p) => { const [k, r] = p.split(":"); return [k, +r]; }));
const SP = (s) => s.trim().split(/\s+/).map((p) => { const [k, w] = p.split(":"); return { key: k, w: +w }; });
const L = (s) => s.trim().split(/\s+/);

const builds = [
  {
    class: "warrior", name: "Guerrier Armes", race: "gnome", alt: "",
    talents: T(`imp_heroic:5 deflection:2 tactical_mastery:5 imp_rend:2 deep_wounds:1 impale:1 two_hand_spec:5 sweeping_strikes:1 imp_execute:3 sword_spec:5 mortal_wounds:1
      cruelty:5 unbridled_wrath:5 imp_battle_shout:1 rampage:1 imp_cleave:3 dual_wield_spec:5`),
    spells: SP("mortal_strike:5 cleave:5 execute:4 whirlwind:3 rend:3 battle_shout:2"), ban: L("shield_slam thunder_clap demo_shout"),
    rings: L("accuria quick_strike dragonslayer blooddrinker"), trinkets: L("chosen earthstrike hoj blackhand"), amulets: L("leg:mortal_strike leg:cleave fire_lord onyxia_tooth"),
    fr: "Frappe mortelle dès le départ, relancée à chaque victime. Balayage fait toucher 2 ennemis de plus à Frappe mortelle, Enchaînement et Exécution.",
    en: "Mortal Strike from the start, reset on every kill. Sweeping Strikes makes Mortal Strike, Cleave and Execute hit 2 more enemies.",
  },
  {
    class: "warrior", name: "Guerrier Fureur", race: "gnome", alt: "",
    talents: T(`cruelty:5 booming_voice:2 unbridled_wrath:3 imp_battle_shout:2 rampage:1 imp_cleave:3 dual_wield_spec:5 imp_whirlwind:3 flurry:1 death_wish:3 imp_berserker:2 bladestorm:1
      imp_heroic:5 deflection:1 tactical_mastery:5 deep_wounds:1 anger_management:3 two_hand_spec:5`),
    spells: SP("whirlwind:5 bloodthirst:5 cleave:4 battle_shout:3 execute:3 bloodrage:2"), ban: L("shield_slam thunder_clap rend"),
    rings: L("accuria quick_strike dragonslayer blooddrinker"), trinkets: L("chosen earthstrike hoj blackhand"), amulets: L("leg:whirlwind leg:bloodthirst fire_lord onyxia_tooth"),
    fr: "Tourbillon gratuit toutes les 3 s grâce à l'apogée, Rafale fait frapper deux fois Tourbillon et Sanguinaire. Plaies profondes et Traumatisme en complément.",
    en: "A free Whirlwind every 3 sec from the capstone, Flurry makes Whirlwind and Bloodthirst strike twice. Deep Wounds and Trauma on the side.",
  },
  {
    class: "warrior", name: "Guerrier Protection", race: "nightelf", alt: "",
    talents: T(`shield_spec:5 anticipation:5 imp_thunder_clap:3 heavy_shield:3 shockwave:1 imp_demo_shout:3 defiance:3 imp_shield_slam:3 fortified:1 unbreakable:3 titan:1
      deflection:5 imp_heroic:1 tactical_mastery:5 deep_wounds:1 anger_management:3 two_hand_spec:5`),
    spells: SP("shield_slam:5 thunder_clap:5 demo_shout:4 whirlwind:3 cleave:3 bloodrage:2"), ban: L("rend mortal_strike bloodthirst"),
    rings: L("archimtiros accuria dark_iron quick_strike"), trinkets: L("chosen lifegiving earthstrike star_of_mystaria"), amulets: L("steadfast_might leg:shield_slam animated_chain fallen_dragon"),
    fr: "Défi donne +100 % de dégâts par tranche de 10 % de réduction des dégâts : tout ce qui réduit les dégâts subis augmente les dégâts (Spécialisation bouclier, Déviation, Médaillon de puissance inébranlable). L'Elfe de la nuit apporte 5 % de réduction.",
    en: "Defiance gives +100% damage per 10% damage reduction: everything that reduces damage taken raises your damage (Shield Specialization, Deflection, Medallion of Steadfast Might). Night Elves bring 5% reduction.",
  },
  {
    class: "paladin", name: "Paladin Sacré", race: "human", alt: "gnome",
    talents: T(`divine_strength:5 divine_intellect:1 imp_seal:5 divine_favor:1 unyielding_faith:3 holy_power:5 lasting_judgement:3 daybreak:1 sanctified_light:4 purifying_power:2 lights_grace:1
      imp_might:5 benediction:5 imp_judgement:3 deflection_pal:1 seal_of_command:1 conviction:5`),
    spells: SP("holy_shock:5 holy_wrath:5 consecration:4 exorcism:4 judgement:3 hammer_of_wrath:3"), ban: L("holy_light redemption holy_shield"),
    rings: L("accuria quick_strike dragonslayer spell_power"), trinkets: L("chosen earthstrike hoj tep"), amulets: L("leg:holy_wrath leg:holy_shock fire_lord malice_stone"),
    fr: "Horion sacré dès le départ (rebonds), ses critiques font tomber Colère divine, et l'apogée en lance une toutes les 14 s. Sceau d'autorité ajoute Jugement.",
    en: "Holy Shock from the start (leaping bolts), its crits call down Holy Wrath, and the capstone adds one every 14 sec. Seal of Command adds Judgement.",
  },
  {
    class: "paladin", name: "Paladin Protection", race: "dwarf", alt: "",
    talents: T(`redoubt:5 imp_devotion:3 imp_consecration:3 hallowed_ground:1 judgement_crusader:3 weighted_hammer:1 righteous_fury:3 imp_hoj:3 ardent_defender:1 blessed_life:3 sacred_duty:3 divine_intervention:1 hammer_righteous:1
      imp_might:5 benediction:5 deflection_pal:4 seal_of_command:1 pursuit:1 conviction:4`),
    spells: SP("hammer_of_justice:5 consecration:5 holy_shield:4 holy_wrath:3 exorcism:3 judgement:2"), ban: L("holy_light redemption holy_shock"),
    rings: L("dark_iron accuria archimtiros blooddrinker"), trinkets: L("lifegiving chosen star_of_mystaria earthstrike"), amulets: L("leg:consecration steadfast_might animated_chain fallen_dragon"),
    fr: "Marteau de la justice consacre le sol, chaque Consécration pose un bouclier et +20 % de dégâts tant qu'il tient. Les dégâts suivent la vie max. Le Nain ajoute un bouclier de 30 % de vie toutes les 45 s.",
    en: "Hammer of Justice hallows the ground, every Consecration raises a shield and +20% damage while it holds. Damage scales with max health. Dwarves add a 30% health shield every 45 sec.",
  },
  {
    class: "paladin", name: "Paladin Vindicte", race: "human", alt: "gnome",
    talents: T(`imp_might:5 benediction:5 imp_judgement:3 deflection_pal:1 seal_of_command:1 conviction:5 righteous_hammer:3 art_of_war:1 sanctity_aura:3 vindication:3 divine_storm:1
      divine_strength:5 imp_seal:5 divine_favor:1 unyielding_faith:3 divine_intellect:1 holy_power:5`),
    spells: SP("exorcism:5 judgement:5 hammer_of_wrath:4 holy_shock:3 consecration:3 holy_wrath:3"), ban: L("holy_light redemption holy_shield"),
    rings: L("accuria dragonslayer quick_strike blooddrinker"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:exorcism leg:judgement onyxia_tooth eye_of_hakkar"),
    fr: "Exorcisme dès le départ avec éclaboussure, L'art de la guerre en relance sur les critiques. Beaucoup de critique (Conviction, Puissance sacrée), Jugement et Horion sacré en plus.",
    en: "Exorcism from the start with a splash, The Art of War fires more on crits. Plenty of crit (Conviction, Holy Power), plus Judgement and Holy Shock.",
  },
  {
    class: "hunter", name: "Chasseur Maîtrise des bêtes", race: "orc", alt: "gnome",
    talents: T(`imp_hawk:5 imp_monkey:3 pathfinding:2 tame_beast:1 unleashed_fury:5 ferocity_hunter:5 frenzy_hunter:1 bestial_discipline:3 ferocious_inspiration:3 intimidation:2 bestial_wrath:1
      lethal_shots:5 efficiency:5 piercing_shots:1 mortal_shots:5 ranged_spec:4`),
    spells: SP("multi_shot:5 hunters_mark:5 auto_shot:4 aimed_shot:3 volley:3 serpent_sting:2"), ban: L("concussive_shot frost_trap immolation_trap"),
    rings: L("accuria dragonslayer quick_strike blooddrinker"), trinkets: L("chosen earthstrike hoj blackhand"), amulets: L("leg:multi_shot leg:hunters_mark fire_lord onyxia_tooth"),
    fr: "Loup puis raptor : les familiers font près de la moitié des dégâts (+160 % avec Furie libérée et Discipline bestiale), et leurs morsures lancent des Flèches multiples gratuites.",
    en: "Wolf then raptor: pets deal close to half the damage (+160% with Unleashed Fury and Bestial Discipline), and their bites fire free Multi-Shots.",
  },
  {
    class: "hunter", name: "Chasseur Précision", race: "troll", alt: "gnome",
    talents: T(`lethal_shots:5 efficiency:5 piercing_shots:1 mortal_shots:5 ranged_spec:5 imp_multi_shot:2 rapid_fire:1 barrage:3 scatter_shot:3 kill_shot:1
      imp_hawk:5 imp_monkey:3 pathfinding:2 tame_beast:1 unleashed_fury:4 ferocity_hunter:5`),
    spells: SP("aimed_shot:5 auto_shot:5 multi_shot:4 volley:3 hunters_mark:3 arcane_shot:2"), ban: L("frost_trap immolation_trap concussive_shot"),
    rings: L("accuria dragonslayer quick_strike spell_power"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:aimed_shot leg:auto_shot onyxia_tooth malice_stone"),
    fr: "Visée dès le départ, relancée à chaque victime, et une Visée gratuite tous les 6 tirs. Tir automatique perce. Le loup de Maîtrise des bêtes vient en renfort.",
    en: "Aimed Shot from the start, reset on kills, and a free Aimed Shot every 6th shot. Auto Shot pierces. The Beast Mastery wolf helps out.",
  },
  {
    class: "hunter", name: "Chasseur Survie", race: "tauren", alt: "",
    talents: T(`monster_slaying:5 deflection_hunter:2 clever_traps:3 survivalist:2 entrapment:1 savage_strikes:3 trap_mastery:3 surefooted:2 explosive_ammo:1 killer_instinct:3 lightning_reflexes:5 wyvern_sting:1
      imp_hawk:5 imp_monkey:3 pathfinding:2 tame_beast:1 unleashed_fury:4 ferocity_hunter:5`),
    spells: SP("immolation_trap:5 frost_trap:4 kill_command:4 multi_shot:4 auto_shot:3 volley:3"), ban: L("aimed_shot concussive_shot arcane_shot"),
    rings: L("accuria spell_power quick_strike seal_damned"), trinkets: L("chosen earthstrike tep hoj"), amulets: L("leg:immolation_trap fire_lord malice_stone onyxia_tooth"),
    fr: "Pièges à vos pieds : on se bat au contact, d'où la Tauren et ses points de vie. Moins de dégâts que Maîtrise des bêtes dans nos essais, à réserver aux zones faciles.",
    en: "Traps at your feet: you fight in melee range, hence Tauren and its health. Less damage than Beast Mastery in our tests, best kept for easy zones.",
  },
  {
    class: "rogue", name: "Voleur Assassinat", race: "gnome", alt: "",
    talents: T(`malice:5 murder:5 ruthlessness:2 deadly_poison:1 lethality:5 vile_poisons:5 mutilate:1 seal_fate:3 remorseless:3 toxic_bloom:1
      master_deception:5 initiative:5 cheat_death:1 imp_ambush:3 elusiveness:1 serrated_blades:3 setup:2`),
    spells: SP("rupture:5 sinister_strike:5 eviscerate:4 seal_fate:3 blade_flurry:3 ghostly_strike:2"), ban: L("gouge kidney_shot backstab"),
    rings: L("accuria seal_damned dragonslayer quick_strike"), trinkets: L("chosen earthstrike blackhand hoj"), amulets: L("leg:rupture eye_of_hakkar fire_lord leg:sinister_strike"),
    fr: "Poisons et saignements partout, et les ennemis empoisonnés explosent en nuage toxique. Initiative de Finesse donne 30 % de chance et Tromper la mort sauve une fois.",
    en: "Poisons and bleeds everywhere, and poisoned enemies burst in a toxic cloud. Subtlety's Initiative gives 30% luck and Cheat Death saves you once.",
  },
  {
    class: "rogue", name: "Voleur Combat", race: "gnome", alt: "",
    talents: T(`precision_rogue:5 imp_sinister:3 endurance_rogue:4 blade_flurry_talent:1 dual_wield_rogue:5 sword_spec_rogue:2 weapon_expertise:3 adrenaline:1 aggression:3 imp_slice_dice:3 killing_spree:1
      malice:5 murder:5 deadly_poison:1 lethality:5 vile_poisons:4`),
    spells: SP("sinister_strike:5 eviscerate:5 blade_flurry:4 adrenaline_rush:3 slice_and_dice:3 ghostly_strike:2"), ban: L("backstab gouge kidney_shot"),
    rings: L("accuria quick_strike dragonslayer blooddrinker"), trinkets: L("chosen earthstrike hoj tep"), amulets: L("leg:sinister_strike leg:eviscerate malice_stone onyxia_tooth"),
    fr: "Attaque pernicieuse gratuite toutes les 3 s sur 2 cibles, Déluge de lames fait toucher 2 ennemis de plus, Poussée d'adrénaline toutes les 20 victimes.",
    en: "A free Sinister Strike every 3 sec on 2 targets, Blade Flurry hits 2 more enemies, Adrenaline Rush every 20 kills.",
  },
  {
    class: "rogue", name: "Voleur Finesse", race: "gnome", alt: "",
    talents: T(`opportunity:5 master_deception:1 initiative:5 elusiveness:1 cheat_death:1 imp_ambush:3 serrated_blades:3 setup:2 preparation:1 dirty_deeds:3 deadliness:5 shadow_dance:1
      malice:5 murder:5 deadly_poison:1 lethality:5 vile_poisons:4`),
    spells: SP("backstab:5 eviscerate:5 gouge:4 rupture:3 kidney_shot:3 ghostly_strike:2"), ban: L("sinister_strike blade_flurry slice_and_dice"),
    rings: L("accuria dragonslayer quick_strike seal_damned"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:backstab leg:eviscerate onyxia_tooth fire_lord"),
    fr: "Attaque sournoise dès le départ avec éclaboussure, Suriner gratuit toutes les 6 s étourdit autour de vous et Sales coups ajoute +24 % sur les étourdis. 30 % de chance avec Initiative.",
    en: "Backstab from the start with a splash, a free Gouge every 6 sec stuns around you and Dirty Deeds adds +24% on stunned enemies. 30% luck from Initiative.",
  },
  {
    class: "priest", name: "Prêtre Discipline", race: "troll", alt: "gnome",
    talents: T(`wand_spec:5 imp_pw_shield:3 martyrdom:2 divine_aegis:1 mental_agility:5 mental_strength:5 rapture:1 force_of_will:4 silent_resolve:3 imp_inner_fire:1 penance:1
      holy_spec:5 divine_fury:5 holy_nova_talent:1 holy_reach:3 inspiration:1 searing_light:3 spiritual_guidance:2`),
    spells: SP("smite:5 pw_shield:5 holy_fire:4 holy_nova:4 mind_blast:3 sw_pain:2"), ban: L("renew psychic_scream mind_flay"),
    rings: L("accuria quick_strike dragonslayer spell_power"), trinkets: L("chosen earthstrike hoj tep"), amulets: L("leg:smite leg:pw_shield malice_stone fire_lord"),
    fr: "Pénitence gratuite toutes les 3 s, Mot de pouvoir : Bouclier dès le départ qui explose en se brisant et se relève aussitôt. Résolution silencieuse donne 24 % de chance.",
    en: "A free Penance every 3 sec, Power Word: Shield from the start that bursts when it breaks and comes back at once. Silent Resolve gives 24% luck.",
  },
  {
    class: "priest", name: "Prêtre Sacré", race: "troll", alt: "gnome",
    talents: T(`holy_spec:5 divine_fury:5 holy_nova_talent:1 holy_reach:3 inspiration:1 searing_light:3 spiritual_guidance:5 holy_fire_talent:1 spiritual_healing:1 holy_concentration:3 blessed_recovery:2 chastise:1
      wand_spec:5 martyrdom:5 divine_aegis:1 mental_agility:4 mental_strength:5`),
    spells: SP("smite:5 holy_nova:5 holy_fire:4 pw_shield:3 mind_blast:3 renew:2"), ban: L("devouring_plague psychic_scream mind_flay"),
    rings: L("accuria dragonslayer quick_strike spell_power"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:smite leg:holy_nova onyxia_tooth malice_stone"),
    fr: "Châtiment touche 2 ennemis et chaque critique déclenche un Nova sacré gratuit : tout mise sur le critique (Spécialisation sacrée, Troll).",
    en: "Smite hits 2 enemies and every crit sets off a free Holy Nova: everything goes into crit (Holy Specialization, Troll).",
  },
  {
    class: "priest", name: "Prêtre Ombre", race: "troll", alt: "gnome",
    talents: T(`blackout:3 spirit_tap:2 imp_swp:2 shadow_focus:5 shadow_weaving:1 imp_mind_blast:5 darkness:5 imp_psychic_scream:1 shadowy_apparitions:1 shadow_power:3 imp_vampiric:2 shadowform:1
      unbreakable_will:5 martyrdom:5 divine_aegis:1 mental_agility:4 mental_strength:5`),
    spells: SP("sw_pain:5 mind_blast:5 devouring_plague:4 mind_flay:4 pw_shield:2 holy_nova:2"), ban: L("smite renew holy_fire"),
    rings: L("accuria seal_damned quick_strike blooddrinker"), trinkets: L("chosen earthstrike hoj tep"), amulets: L("leg:sw_pain leg:devouring_plague fire_lord eye_of_hakkar"),
    fr: "Mot de l'ombre : Douleur dès le départ, ses dégâts réguliers lancent des Attaques mentales gratuites et la douleur saute d'un ennemi mort au suivant.",
    en: "Shadow Word: Pain from the start, its ticks fire free Mind Blasts and the pain jumps from a dead enemy to the next.",
  },
  {
    class: "shaman", name: "Chaman Élémentaire", race: "orc", alt: "gnome",
    talents: T(`concussion:5 convection:5 earths_grasp:3 lightning_overload:1 reverberation:5 call_of_thunder:5 elemental_fury:1 lightning_mastery:5 elemental_devastation:3 storm_reach:2 elemental_mastery:1
      enh_earthen_bulwark:5 enh_shattering_elements:2 tidal_focus:5 natures_guidance:3`),
    spells: SP("chain_lightning:5 lightning_bolt:5 earth_shock:3 frost_shock:3 flame_shock:3 lightning_shield:3"), ban: L("healing_wave searing_totem fire_nova"),
    rings: L("accuria dragonslayer quick_strike spell_power"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:chain_lightning leg:lightning_bolt onyxia_tooth malice_stone"),
    fr: "Chaîne d'éclairs dès le départ, une seconde toutes les 3 s, qui rebondit sur 3 ennemis de plus sans rien perdre. +35 % aux sorts de Nature. Étreinte de la terre et Garde-tempête réduisent les dégâts subis, Bouclier de foudre actif.",
    en: "Chain Lightning from the start, a second one every 3 sec, jumping to 3 more enemies with no loss. +35% to Nature spells. Earth's Grasp and Stormguard cut damage taken while Lightning Shield is up.",
  },
  {
    class: "shaman", name: "Chaman Amélioration", race: "tauren", alt: "gnome",
    talents: T(`enh_thundering_strikes:2 enh_earthen_bulwark:5 enh_resonant_shocks:3 enh_shattering_elements:3 rockbiter_initiation:1 enh_windfury_weapon:3 enh_flametongue_weapon:3 enh_frostbrand_weapon:3 enh_unleashed_weapons:1 enh_ancestral_fortitude:3 enh_flurry:3 enh_stormbound_echoes:1
      concussion:5 convection:5 earths_grasp:3 call_of_flame:3 reverberation:4`),
    spells: SP("flame_shock:5 fire_nova:5 rockbiter:4 frost_shock:3 earth_shock:3 stormstrike:3"), ban: L("lightning_bolt chain_lightning lightning_shield"),
    rings: L("blooddrinker accuria dragonslayer quick_strike"), trinkets: L("earthstrike hoj chosen lifegiving"), amulets: L("leg:flame_shock leg:fire_nova fire_lord jeklik"),
    fr: "Spé des horions, faite pour le set des éléments (8 pièces : un ennemi qui meurt sous Horion de flammes explose pour 15 % de sa vie max à 8 m). Horion de flammes à 20 m et Horions résonnants pour le poser sur 3 ennemis de plus, Arme Langue de feu pour des Novas de feu gratuites, Arme Givrefeu pour des Horions de givre gratuits et Éléments fracassants qui renforcent l'horion suivant. Se joue à distance.",
    en: "The shock spec, made for the Elements set (8 pieces: an enemy dying with Flame Shock explodes for 15% of its max health within 8 yd). Flame Shock at 20 yd and Resonant Shocks to spread it to 3 more enemies, Flametongue Weapon for free Fire Novas, Frostbrand for free Frost Shocks and Shattering Elements boosting the next shock. Played at range.",
  },
  {
    class: "shaman", name: "Chaman Totems", race: "tauren", alt: "",
    talents: T(`tidal_focus:5 totemic_focus:5 twin_totems:1 restorative_totems:3 natures_guidance:1 tidal_mastery:5 reincarnation:1 purification:4 totemic_mastery:2 ancestral_healing:3 totemic_call:1
      concussion:5 convection:5 call_of_flame:3 lightning_overload:1 reverberation:1 imp_fire_totems:2 call_of_thunder:3`),
    spells: SP("magma_totem:5 searing_totem:5 fire_nova:4 flame_shock:3 chain_lightning:3 lightning_bolt:2"), ban: L("lightning_shield frost_shock earth_shock"),
    rings: L("accuria spell_power quick_strike blooddrinker"), trinkets: L("chosen earthstrike tep lifegiving"), amulets: L("leg:magma_totem leg:searing_totem fire_lord malice_stone"),
    fr: "Arbre Restauration joué en totems : chaque totem en pose un second, Totem de magma dès le départ et un Totem incendiaire gratuit toutes les 14 s. Réincarnation sauve une fois toutes les 2 min, Guérison ancestrale au maximum (9 % de réduction des dégâts) contre le pic qui tue le round suivant.",
    en: "The Restoration tree played with totems: every totem drops a second one, Magma Totem from the start and a free Searing Totem every 14 sec. Reincarnation saves you every 2 min, Ancestral Healing maxed (9% less damage taken) against the burst that kills next.",
  },
  {
    class: "mage", name: "Mage Arcanes", race: "gnome", alt: "",
    talents: T(`arcane_focus:5 arcane_subtlety:5 imp_arcane_explosion:3 magic_absorption:1 arcane_concentration:1 arcane_meditation:1 arcane_mind:5 presence_of_mind:1 arcane_instability:3 arcane_reach:3 arcane_fortitude:2 arcane_power:1
      frost_warding:5 elemental_precision:3 ice_shards:5 frostbite:1 piercing_ice:1 shatter:5`),
    spells: SP("arcane_missiles:5 arcane_explosion:5 ice_barrier:3 frost_nova:3 blizzard:3 cone_of_cold:2"), ban: L("fireball flamestrike polymorph"),
    rings: L("accuria quick_strike dragonslayer spell_power"), trinkets: L("chosen hoj earthstrike tep"), amulets: L("leg:arcane_missiles malice_stone leg:arcane_explosion onyxia_tooth"),
    fr: "Projectiles des arcanes dès le départ, qui rebondissent, et des sorts qui frappent deux fois en cascade : tout ce qui fait doubler (Main de justice, Pierre de malveillance) vaut double. 60 % de chance avec le Gnome.",
    en: "Arcane Missiles from the start, leaping between enemies, and spells that strike twice in cascades: anything that doubles casts (Hand of Justice, Malice Stone) is worth double. 60% luck with a Gnome.",
  },
  {
    class: "mage", name: "Mage Feu", race: "gnome", alt: "",
    talents: T(`imp_fireball:5 imp_flamestrike:5 flame_throwing:2 ignite:1 incinerate:2 master_elements:3 critical_mass:3 hot_streak:1 fire_power:5 imp_blast_wave:3 pyroclasm:1
      arcane_subtlety:5 magic_absorption:5 arcane_concentration:1 arcane_meditation:3 imp_arcane_explosion:1 arcane_mind:5`),
    spells: SP("pyroblast:5 flamestrike:5 blast_wave:4 ice_barrier:4 fireball:3 fire_blast:3"), ban: L("frostbolt polymorph arcane_missiles"),
    rings: L("accuria dragonslayer quick_strike spell_power"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:flamestrike leg:pyroblast leg:blast_wave fire_lord"),
    fr: "Explosion pyrotechnique dès le départ, les ennemis tués au feu explosent, Embrasement et Chaleur continue sur les critiques. L’Amulette de l’Enfer : Choc de flammes est la priorité absolue : à Gurubashi, améliorée 11 fois, elle a triplé le DPS (466 k contre 150 k). Subtilité des arcanes (40 % de chance) et Esprit des arcanes en appoint.",
    en: "Pyroblast from the start, enemies killed by fire explode, Ignite and Hot Streak on crits. The Amulet of the Inferno: Flamestrike is the top priority: at Gurubashi, upgraded 11 times, it tripled DPS (466k vs 150k). Arcane Subtlety (40% luck) and Arcane Mind on the side.",
  },
  {
    class: "mage", name: "Mage Givre", race: "gnome", alt: "",
    talents: T(`imp_frostbolt:5 elemental_precision:3 ice_shards:3 frostbite:1 piercing_ice:3 shatter:5 splitting_ice:1 frost_channeling:3 arctic_reach:1 permafrost:3 imp_ice_barrier:2 water_elemental:1
      arcane_subtlety:5 magic_absorption:5 arcane_concentration:1 arcane_meditation:3 imp_arcane_explosion:1 arcane_mind:5`),
    spells: SP("frostbolt:5 blizzard:4 frost_nova:4 cone_of_cold:4 ice_barrier:3 arcane_explosion:3"), ban: L("fireball flamestrike polymorph"),
    rings: L("accuria quick_strike dragonslayer spell_power"), trinkets: L("chosen earthstrike hoj tep"), amulets: L("leg:frostbolt leg:blizzard malice_stone fire_lord"),
    fr: "Éclair de givre dès le départ qui éclate sur la zone, un élémentaire d'eau et une Nova de givre gratuite toutes les 8 s : les ennemis gelés prennent +25 % avec Fracasser. Le plus sûr des trois.",
    en: "Frostbolt from the start splintering on impact, a Water Elemental and a free Frost Nova every 8 sec: frozen enemies take +25% with Shatter. The safest of the three.",
  },
  {
    class: "warlock", name: "Démoniste Affliction", race: "gnome", alt: "",
    talents: T(`suppression:5 imp_corruption:5 imp_coa:3 imp_drain_life:2 nightfall:1 grim_reach:1 shadow_mastery:5 contagion:1 amplify_curse:3 siphon_life:1 fel_concentration:3 seed_of_corruption:1
      imp_shadow_bolt:5 cataclysm:5 shadowburn:1 imp_searing_pain:3 aftermath:1 devastation:5`),
    spells: SP("corruption:5 curse_of_agony:5 shadow_bolt:4 drain_life:3 immolate:3 death_coil:2"), ban: L("fear demonic_empowerment hellfire"),
    rings: L("seal_damned accuria quick_strike dragonslayer"), trinkets: L("chosen earthstrike hoj tep"), amulets: L("leg:corruption leg:curse_of_agony fire_lord eye_of_hakkar"),
    fr: "Corruption dès le départ, les ennemis morts sous vos dégâts sur la durée explosent et Contagion propage Corruption et Agonie. Suppression donne 25 % de chance, 45 % avec le Gnome.",
    en: "Corruption from the start, enemies dying under your damage over time explode and Contagion spreads Corruption and Agony. Suppression gives 25% luck, 45% with a Gnome.",
  },
  {
    class: "warlock", name: "Démoniste Démonologie", race: "gnome", alt: "",
    talents: T(`demonic_familiar:5 demonic_embrace:5 unholy_power:5 soul_devourer:3 felfire_training:3 master_demonologist:3 legion_gate:1 summon_doomguard:3 summon_infernal:2 butcher:1
      suppression:5 imp_corruption:5 imp_coa:3 nightfall:1 dark_pact:1 shadow_mastery:5`),
    spells: SP("demonic_empowerment:5 shadow_bolt:4 corruption:4 immolate:3 searing_pain:3 curse_of_agony:3"), ban: L("fear drain_life hellfire"),
    rings: L("accuria quick_strike dragonslayer seal_damned"), trinkets: L("chosen war_horn earthstrike tep"), amulets: L("leg:demonic_empowerment malice_stone fire_lord darkmoon"),
    fr: "Une armée : diablotin et chasseur corrompu permanents, démons mineurs toutes les 4 s, gangregarde toutes les 30 s (plus vite avec les temps de recharge). Les démons font l'essentiel des dégâts.",
    en: "An army: permanent Imp and Felhunter, lesser demons every 4 sec, a Felguard every 30 sec (faster with cooldown reduction). Demons deal most of the damage.",
  },
  {
    class: "warlock", name: "Démoniste Destruction", race: "gnome", alt: "",
    talents: T(`imp_shadow_bolt:5 cataclysm:5 shadowburn:1 imp_searing_pain:3 aftermath:1 devastation:5 conflagrate:1 emberstorm:4 ruin:3 bane:2 rain_of_chaos:1
      suppression:5 imp_corruption:5 imp_coa:3 imp_drain_life:1 nightfall:1 shadow_mastery:5`),
    spells: SP("shadow_bolt:5 immolate:5 rain_of_fire:4 searing_pain:4 corruption:3 soul_fire:2"), ban: L("fear drain_life demonic_empowerment"),
    rings: L("accuria dragonslayer spell_power quick_strike"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:shadow_bolt leg:rain_of_fire onyxia_tooth fire_lord"),
    fr: "Trait de l'ombre qui se divise, Immolation dès le départ et Conflagration qui fait exploser les ennemis immolés, une seconde Pluie de feu toutes les 13 s.",
    en: "Shadow Bolt splitting on impact, Immolate from the start and Conflagrate blowing up immolated enemies, a second Rain of Fire every 13 sec.",
  },
  {
    class: "druid", name: "Druide Équilibre", race: "nightelf", alt: "gnome",
    talents: T(`imp_wrath:5 natural_weapons:5 omen_of_clarity:1 vengeance_druid:5 imp_starfire:3 moonglow:3 starfall:1 imp_moonfire:2 moonfury:5 force_of_nature:1
      imp_motw:5 natures_focus:5 swiftmend:1 reflection:3 furor:1 tranquil_spirit:5`),
    spells: SP("starfire:5 moonfire:5 hurricane:4 wrath:4 insect_swarm:3 rejuvenation:2"), ban: L("entangling_roots regrowth swipe"),
    rings: L("accuria dragonslayer quick_strike spell_power"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:starfire leg:moonfire onyxia_tooth fire_lord"),
    fr: "Éclat lunaire dès le départ, deux tréants, une Colère stellaire gratuite toutes les 4 s et d'autres sur 18 % des sorts. Esprit serein de Restauration ajoute 17,5 % de dégâts.",
    en: "Moonfire from the start, two treants, a free Starfire every 4 sec and more on 18% of spells. Restoration's Tranquil Spirit adds 17.5% damage.",
  },
  {
    class: "druid", name: "Druide Félin", race: "tauren", alt: "",
    talents: T(`ferocity_druid:5 feral_instinct:3 brutal_impact:3 rake:1 sharpened_claws:3 predatory_strikes:3 thick_hide:3 blood_frenzy:1 savage_fury:3 heart_of_wild:5 cat_form:1
      imp_motw:5 natures_focus:5 swiftmend:1 reflection:3 furor:1 tranquil_spirit:5`),
    spells: SP("shred:5 swipe:5 faerie_fire:3 thorns:3 hurricane:2 insect_swarm:2"), ban: L("wrath starfire rejuvenation"),
    rings: L("accuria dragonslayer quick_strike blooddrinker"), trinkets: L("chosen blackhand earthstrike hoj"), amulets: L("leg:shred leg:swipe onyxia_tooth eye_of_hakkar"),
    fr: "Forme de félin : +10 % de dégâts et de critique, Lambeau et Balayage dès le départ, chaque coup fait saigner et les critiques encore plus.",
    en: "Cat Form: +10% damage and crit, Shred and Swipe from the start, every hit bleeds and crits bleed even more.",
  },
  {
    class: "druid", name: "Druide Ours", race: "tauren", alt: "",
    talents: T(`ferocity_druid:5 feral_instinct:3 brutal_impact:3 rake:1 sharpened_claws:3 predatory_strikes:3 thick_hide:3 blood_frenzy:1 savage_fury:3 heart_of_wild:3 primal_fury:2 leader_of_pack:1
      imp_motw:5 natures_focus:5 swiftmend:1 reflection:3 furor:1 tranquil_spirit:5`),
    spells: SP("swipe:5 shred:4 thorns:4 faerie_fire:3 regrowth:2 insect_swarm:2"), ban: L("wrath starfire hurricane"),
    rings: L("dark_iron blooddrinker archimtiros accuria"), trinkets: L("chosen lifegiving earthstrike star_of_mystaria"), amulets: L("leg:swipe steadfast_might jeklik fallen_dragon"),
    fr: "Forme d'ours sacré : +25 % de vie, -10 % de dégâts subis, un Balayage gratuit toutes les 3 s qui soigne à chaque ennemi touché. Le plus solide de tous.",
    en: "Dire Bear Form: +25% health, 10% less damage taken, a free Swipe every 3 sec that heals for every enemy hit. The toughest of all.",
  },
  {
    class: "druid", name: "Druide Restauration", race: "tauren", alt: "",
    talents: T(`imp_motw:5 imp_healing_touch:5 natures_focus:4 swiftmend:1 tranquil_spirit:5 imp_rejuvenation:3 tranquility:1 gift_of_nature:5 imp_tranquility:1 tree_of_life:1
      natures_grasp:3 imp_wrath:2 natural_weapons:5 omen_of_clarity:1 vengeance_druid:4 moonglow:3 imp_starfire:2`),
    spells: SP("rejuvenation:5 regrowth:5 moonfire:4 insect_swarm:3 hurricane:3 thorns:2"), ban: L("wrath starfire shred"),
    rings: L("accuria quick_strike dragonslayer devoured"), trinkets: L("chosen earthstrike tep lifegiving"), amulets: L("leg:regrowth leg:rejuvenation malice_stone fire_lord"),
    fr: "Tranquillité : chaque soin frappe les ennemis à 12 m pour 300 % du soin. Récupération et Rétablissement servent d'armes, et le surplus de soin devient un bouclier.",
    en: "Tranquility: every heal strikes enemies within 12 yd for 300% of the healing. Rejuvenation and Regrowth become weapons, and overhealing turns into a shield.",
  },
];

const RACES = {
  human: { fr: "Humain", en: "Human" }, orc: { fr: "Orc", en: "Orc" }, dwarf: { fr: "Nain", en: "Dwarf" }, nightelf: { fr: "Elfe de la nuit", en: "Night Elf" },
  scourge: { fr: "Mort-vivant", en: "Undead" }, tauren: { fr: "Tauren", en: "Tauren" }, gnome: { fr: "Gnome", en: "Gnome" }, troll: { fr: "Troll", en: "Troll" },
};
const ALLOWED = {
  warrior: ["human", "orc", "dwarf", "nightelf", "scourge", "tauren", "gnome", "troll"], paladin: ["human", "dwarf"],
  hunter: ["orc", "dwarf", "nightelf", "tauren", "troll"], rogue: ["human", "orc", "dwarf", "nightelf", "scourge", "gnome", "troll"],
  priest: ["human", "dwarf", "nightelf", "scourge", "troll"], shaman: ["orc", "tauren", "troll"], mage: ["human", "gnome", "scourge", "troll"],
  warlock: ["human", "orc", "gnome", "scourge"], druid: ["nightelf", "tauren"],
};

// Bijoux dont le simulateur ne modelise pas l'effet (ramassage, experience, or, vitesse, buffs) : sortis au hasard des tirages
const NOSIM = /pickup|experience|gold|movement speed|buffs are/i;
const USELESS = new Set(["rings", "trinkets", "amulets"].flatMap((c) => data[c].filter((j) => j.desc.en.every((l) => NOSIM.test(l))).map((j) => j.key)));
const FILL = { rings: L("accuria quick_strike dragonslayer blooddrinker"), trinkets: L("earthstrike hoj blackhand tep chosen") };
const useful = (list, cat) => list.filter((k) => !USELESS.has(k)).concat(FILL[cat] || []).filter((k, i, x) => x.indexOf(k) === i).slice(0, list.length);

// Builds optimises sur le simulateur cale (tools/build-tune.js)
const TUNE = fs.existsSync(path.join(__dirname, "preset-tune.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "preset-tune.json"), "utf8")) : {};
for (const b of builds) {
  const t = TUNE[b.name];
  if (!t) continue;
  const was = b.spells.map((s) => s.key);
  b.talents = t.talents;
  b.race = t.race;
  b.alt = t.alt;
  b.spells = t.spells.map(([key, w]) => ({ key, w }));
  const now = b.spells.map((s) => s.key);
  b.ban = b.ban.filter((k) => !now.includes(k)).concat(was.filter((k) => !now.includes(k))).slice(0, 3);
  b.rings = useful(t.rings, "rings");
  b.trinkets = useful(t.trinkets, "trinkets");
  b.amulets = t.amulets;
  // Description devenue fausse (sort retire encore cite) : texte court regenere
  const c = data.classes.find((x) => x.key === b.class);
  const nm = (k, l) => c.spells.find((x) => x.key === k).name[l];
  if (was.some((k) => !now.includes(k) && (b.fr.includes(nm(k, "fr")) || b.en.includes(nm(k, "en"))))) {
    const top = (l) => now.slice(0, 3).map((k) => nm(k, l));
    b.fr = "Optimisé au simulateur calé sur les parties partagées : " + top("fr").slice(0, 2).join(", ") + " et " + top("fr")[2] + " en priorité, avec un bouclier ou un soin et un anneau défensif pour tenir jusqu'au bout.";
    b.en = "Tuned on the simulator calibrated with shared runs: " + top("en").slice(0, 2).join(", ") + " and " + top("en")[2] + " first, with a shield or heal and a defensive ring to last to the end.";
  }
}
let errors = 0;
const err = (b, m) => { errors++; console.error(`${b.name}: ${m}`); };
const EN_NAMES = { "Guerrier Armes": "Arms Warrior", "Guerrier Fureur": "Fury Warrior", "Guerrier Protection": "Protection Warrior", "Paladin Sacré": "Holy Paladin", "Paladin Protection": "Protection Paladin", "Paladin Vindicte": "Retribution Paladin", "Chasseur Maîtrise des bêtes": "Beast Mastery Hunter", "Chasseur Précision": "Marksmanship Hunter", "Chasseur Survie": "Survival Hunter", "Voleur Assassinat": "Assassination Rogue", "Voleur Combat": "Combat Rogue", "Voleur Finesse": "Subtlety Rogue", "Prêtre Discipline": "Discipline Priest", "Prêtre Sacré": "Holy Priest", "Prêtre Ombre": "Shadow Priest", "Chaman Élémentaire": "Elemental Shaman", "Chaman Amélioration": "Enhancement Shaman", "Chaman Totems": "Totem Shaman", "Mage Arcanes": "Arcane Mage", "Mage Feu": "Fire Mage", "Mage Givre": "Frost Mage", "Démoniste Affliction": "Affliction Warlock", "Démoniste Démonologie": "Demonology Warlock", "Démoniste Destruction": "Destruction Warlock", "Druide Équilibre": "Balance Druid", "Druide Félin": "Feral Cat Druid", "Druide Ours": "Feral Bear Druid", "Druide Restauration": "Restoration Druid" };
const presets = [];
for (const b of builds) {
  const c = data.classes.find((x) => x.key === b.class);
  const all = c.trees.flatMap((t, ti) => t.talents.map((x) => ({ ...x, ti })));
  let total = 0;
  for (const [k, r] of Object.entries(b.talents)) {
    const t = all.find((x) => x.key === k);
    if (!t) { err(b, "talent inconnu " + k); continue; }
    if (r < 1 || r > t.max) err(b, `${k} rang ${r} sur ${t.max}`);
    total += r;
  }
  if (total !== 51) err(b, `${total} points au lieu de 51`);
  c.trees.forEach((tree, ti) => {
    for (const t of tree.talents) {
      if (!b.talents[t.key]) continue;
      const below = tree.talents.filter((o) => o.row < t.row).reduce((n, o) => n + (b.talents[o.key] || 0), 0);
      if (below < t.row * 5) err(b, `${t.key} rangée ${t.row} : ${below} points en dessous, il en faut ${t.row * 5}`);
    }
  });
  const pairs = [["soul_devourer", "soul_link"], ["pact_of_the_annihilan", "butcher"], ["leader_of_pack", "cat_form"], ["legion_gate", "demonic_supremacy"]];
  for (const [x, y] of pairs) if (b.talents[x] && b.talents[y]) err(b, `${x} et ${y} sont exclusifs`);
  const caps = c.trees.map((t) => t.talents.filter((x) => x.row === 6).filter((x) => b.talents[x.key]).length);
  if (caps.reduce((a, n) => a + n, 0) !== 1) err(b, "il faut exactement une apogée");
  if (b.spells.length !== 6) err(b, b.spells.length + " sorts au lieu de 6");
  for (const s of b.spells) if (!c.spells.some((x) => x.key === s.key)) err(b, "sort inconnu " + s.key);
  for (const k of b.ban) if (!c.spells.some((x) => x.key === k)) err(b, "bannissement inconnu " + k);
  for (const [cat, list] of [["rings", b.rings], ["trinkets", b.trinkets], ["amulets", b.amulets]])
    for (const k of list) {
      if (k.startsWith("leg:")) { if (!data.legendaries[k.slice(4)] || !c.spells.some((x) => x.key === k.slice(4))) err(b, "légendaire inconnue " + k); }
      else if (!data[cat].some((x) => x.key === k)) err(b, `${cat} inconnu ${k}`);
    }
  if (!RACES[b.race]) err(b, "race inconnue " + b.race);
  if (!ALLOWED[b.class].includes(b.race)) err(b, `${b.race} n'est pas une race d'origine pour ${b.class}`);
  if (b.alt && ALLOWED[b.class].includes(b.alt)) err(b, `${b.alt} est déjà une race d'origine, pas besoin d'alternative`);
  const trees = c.trees.map((t) => t.talents.map((x) => b.talents[x.key] || 0).join("")).join("/");
  const code = ["SB1", b.class, b.name, trees, b.spells.map((s) => s.key + ":" + s.w).join(","), b.ban.slice().sort().join(","), b.rings.join(","), b.trinkets.join(","), b.amulets.join(","), RULES].join(";");
  presets.push({ class: b.class, name: b.name, names: { fr: b.name, en: EN_NAMES[b.name] }, author: "AS Companion", race: b.race, raceAlt: b.alt || undefined, code, notes: { fr: b.fr, en: b.en } });
}
if (Object.keys(EN_NAMES).length !== presets.length) err({ name: "noms anglais" }, "il manque des noms anglais");
if (errors) { console.error(errors + " erreur(s), rien n'est écrit"); process.exit(1); }
fs.writeFileSync(out, JSON.stringify(presets, null, 1) + "\n");
console.log(presets.length + " builds écrits dans " + path.relative(process.cwd(), out));
