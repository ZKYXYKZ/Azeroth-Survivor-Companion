local rec, lastSample, lastStats, lastRanks, lastMeter, bossFight, prevPhase = nil, -99, -99, -99, -99, nil, nil

local function clean(s)
  return string.gsub(tostring(s or ""), "[|;,:=\"\n]", " ")
end

local function n(v)
  v = tonumber(v) or 0
  if v == math.floor(v) then return tostring(v) end
  return string.format("%.2f", v)
end

local function push(list, s)
  table.insert(list, s)
end

local function meterLine(lines, max)
  local out = {}
  for i = 1, math.min(table.getn(lines or {}), max) do
    local l = lines[i]
    table.insert(out, clean(l.name) .. "=" .. math.floor(tonumber(l.dmg) or 0))
  end
  return table.concat(out, ",")
end

local function start()
  local z = AZS_ZONE or {}
  rec = { head = table.concat({ clean(z.class), clean(z.race), clean(z.zone), n(z.heroic), n(z.diff), n(z.len), clean(z.gender), clean(z.affixes), z.hyper and "1" or "0" }, ","), samples = {}, units = {}, stats = {}, ranks = {}, meters = {}, bosses = {} }
  lastSample, lastStats, lastRanks, lastMeter, bossFight = -99, -99, -99, -99, nil
end

local function sample(t)
  local r = AZS_RUN or {}
  push(rec.samples, table.concat({ n(t), n(r.lvl), n(r.xp), n(r.xpn), n(r.hp), n(r.hpm), n(r.sh), n(r.en), n(r.el), n(r.bu), n(r.ga), n(r.kills), n(r.gold), n(r.dealt), n(r.taken), n(r.owed), n(r.rr), n(r.bk), n(r.gk), n(r.ek), n(r.ck), n(r.lives) }, ","))
  local u = {}
  for _, x in ipairs(AZS_UNITS or {}) do
    if x.kind ~= "elite" then table.insert(u, clean(x.kind) .. "/" .. clean(x.name) .. "/" .. n(x.hp) .. "/" .. n(x.hpm) .. "/" .. n(x.state)) end
  end
  if table.getn(u) > 0 then push(rec.units, n(t) .. ":" .. table.concat(u, ",")) end
end

local function stats(t)
  local s = {}
  for k, v in pairs(AZS_STATS or {}) do
    if tonumber(v) then table.insert(s, clean(k) .. "=" .. n(v)) end
  end
  push(rec.stats, n(t) .. ":" .. table.concat(s, ","))
end

local function ranks(t)
  local s = {}
  for _, x in ipairs(AZS_SPELLS or {}) do
    if x.key then table.insert(s, clean(x.key) .. "=" .. n(x.rank)) end
  end
  push(rec.ranks, n(t) .. ":" .. table.concat(s, ","))
end

local function meter(t)
  if not AZS_GetMeter then return end
  local lines = AZS_GetMeter()
  push(rec.meters, n(t) .. ":" .. meterLine(lines, 15))
end

local function bosses(t)
  local r = AZS_RUN or {}
  local up = (tonumber(r.bu) or 0) > 0
  if up and not bossFight then
    local names = {}
    for _, x in ipairs(AZS_UNITS or {}) do
      if x.kind == "boss" or x.kind == "final" then table.insert(names, clean(x.name) .. "/" .. n(x.hpm)) end
    end
    bossFight = { start = t, names = table.concat(names, "+") }
  elseif not up and bossFight then
    local total = 0
    if AZS_GetBossMeter then local _, tot = AZS_GetBossMeter() total = tonumber(tot) or 0 end
    push(rec.bosses, bossFight.names .. ":" .. n(bossFight.start) .. ":" .. n(t) .. ":" .. math.floor(total))
    bossFight = nil
  end
end

local function finish(result)
  if not rec then return end
  local t = AZS_GetRunTime and AZS_GetRunTime() or 0
  sample(t)
  stats(t)
  ranks(t)
  meter(t)
  local r = AZS_RUN or {}
  local taken, sched = {}, {}
  for _, x in ipairs(AZS_TAKEN or {}) do table.insert(taken, clean(x.source) .. "=" .. math.floor(tonumber(x.dmg) or 0)) end
  for _, x in ipairs(AZS_SCHEDULE or {}) do table.insert(sched, clean(x.name) .. "/" .. n(x.at) .. "/" .. clean(x.state) .. "/" .. n(x.final)) end
  local heal = AZS_GetHealing and meterLine((AZS_GetHealing()), 10) or ""
  local s = table.concat({ "AZD1", rec.head, result, n(r.lvl), n(r.kills), n(t),
    table.concat(rec.samples, ";"), table.concat(rec.units, ";"), table.concat(rec.stats, ";"), table.concat(rec.ranks, ";"),
    table.concat(rec.meters, ";"), table.concat(rec.bosses, ";"), table.concat(taken, ","), table.concat(sched, ","), heal }, "|")
  local db = SB.DB()
  db.details = db.details or {}
  table.insert(db.details, s)
  while table.getn(db.details) > 50 do table.remove(db.details, 1) end
  rec = nil
end

local f = CreateFrame("Frame")
local acc = 0
f:SetScript("OnUpdate", function()
  acc = acc + arg1
  if acc < 1 then return end
  acc = 0
  if not AZS_GetPhase then return end
  local phase = AZS_GetPhase()
  if phase == "playing" and not rec and (prevPhase == nil or prevPhase == "ready" or prevPhase == "dead" or prevPhase == "victory") then start() end
  if rec and (phase == "dead" or phase == "victory") and phase ~= prevPhase then finish(phase == "victory" and "victory" or "defeat") end
  if rec and (phase == "ready" or phase == nil) and prevPhase ~= phase then finish("defeat") end
  prevPhase = phase
  if not rec or phase ~= "playing" and phase ~= "choosing" then return end
  local t = AZS_GetRunTime and AZS_GetRunTime() or 0
  if t - lastSample >= 10 then lastSample = t sample(t) end
  if t - lastRanks >= 30 then lastRanks = t ranks(t) end
  if t - lastStats >= 60 then lastStats = t stats(t) end
  if t - lastMeter >= 60 then lastMeter = t meter(t) end
  bosses(t)
end)
