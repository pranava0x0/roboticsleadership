#!/usr/bin/env node
/**
 * enrich.js — Automatically populate relations (companies, policies, themes, agency_responsible)
 * across docs/data/news.json and docs/data/policies.json using keyword mapping.
 *
 * Runs as a post-scrape enrichment step.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const DATA_DIR = resolve(ROOT, 'docs/data');

const COMPANY_RULES = [
  { id: 'figure-ai', keywords: [/\bfigure\b/i, /\bfigure-ai\b/i, /\bfigure 01\b/i, /\bfigure 02\b/i] },
  { id: 'apptronik', keywords: [/\bapptronik\b/i, /\bapollo\b/i] },
  { id: '1x-technologies', keywords: [/\b1x\b/i, /\b1x technologies\b/i, /\bhalodi\b/i, /\beve\b/i, /\bneo\b/i] },
  { id: 'agility-robotics', keywords: [/\bagility robotics\b/i, /\bagility\b/i, /\bdigit\b/i] },
  { id: 'boston-dynamics', keywords: [/\bboston dynamics\b/i, /\batlas\b/i, /\bspot\b/i, /\bstretch\b/i] },
  { id: 'tesla-optimus', keywords: [/\btesla\b/i, /\boptimus\b/i, /\btesla humanoid\b/i] },
  { id: 'sanctuary-ai', keywords: [/\bsanctuary\b/i, /\bsanctuary ai\b/i, /\bphoenix\b/i] },
  { id: 'skild-ai', keywords: [/\bskild\b/i, /\bskild-ai\b/i] },
  { id: 'physical-intelligence', keywords: [/\bphysical intelligence\b/i, /\bπ0\b/i, /\bpi0\b/i] },
  { id: 'unitree', keywords: [/\bunitree\b/i, /\bh1\b/i, /\bg1\b/i] },
  { id: 'ubtech', keywords: [/\bubtech\b/i, /\bwalker\b/i] },
  { id: 'agibot', keywords: [/\bagibot\b/i] },
  { id: 'robotera', keywords: [/\brobotera\b/i] },
  { id: 'engineai', keywords: [/\bengineai\b/i] },
  { id: 'symbotic', keywords: [/\bsymbotic\b/i] },
  { id: 'locus-robotics', keywords: [/\blocus robotics\b/i, /\blocus\b/i] },
  { id: 'diligent-robotics', keywords: [/\bdiligent robotics\b/i, /\bdiligent\b/i, /\bmoxi\b/i] },
  { id: 'anduril', keywords: [/\banduril\b/i] },
  { id: 'shield-ai', keywords: [/\bshield ai\b/i, /\bhivemind\b/i, /\bnova\b/i] },
  { id: 'covariant', keywords: [/\bcovariant\b/i, /\brfm-1\b/i] }
];

const THEME_RULES = [
  { id: 'china-scale', keywords: [/\bchina\b/i, /\bchinese\b/i, /\bbeijing\b/i, /\bunitree\b/i, /\bubtech\b/i, /\bagibot\b/i, /\brobotera\b/i, /\bengineai\b/i, /\bgalbot\b/i, /\blimx\b/i] },
  { id: 'foundation-models', keywords: [/\bfoundation model\b/i, /\bvla\b/i, /\bllm\b/i, /\bgpt\b/i, /\bneural network\b/i, /\bskild\b/i, /\bphysical intelligence\b/i, /\bcovariant\b/i, /\brfm-1\b/i, /\bπ0\b/i, /\bpi0\b/i, /\bembodied ai\b/i, /\bai safety\b/i, /\bai rmf\b/i, /\brisk management framework\b/i] },
  { id: 'cost-trajectory', keywords: [/\bunit cost\b/i, /\bunit-cost\b/i, /\bhardware cost\b/i, /\bbill of materials\b/i, /\bbom\b/i, /\bprice tag\b/i, /\bprice\b/i, /\bcheap\b/i, /\baffordable\b/i, /under \$\d+/i] },
  { id: 'defense-procurement', keywords: [/\bdefense\b/i, /\bmilitary\b/i, /\bpentagon\b/i, /\bdod\b/i, /\breplicator\b/i, /\banduril\b/i, /\bshield ai\b/i, /\bdarpa\b/i, /\bspace force\b/i, /\bnavy\b/i, /\barmy\b/i, /\bair force\b/i] },
  { id: 'industrial-deployments', keywords: [/\bdeploy\b/i, /\bpilot\b/i, /\bwarehouse\b/i, /\bfactory\b/i, /\bfacility\b/i, /\bmanufacturing\b/i, /\bautomotive\b/i, /\bbmw\b/i, /\bmercedes\b/i, /\bnvidia isaac\b/i, /\bcommercial\b/i] },
  { id: 'policy-momentum', keywords: [/\bpolicy\b/i, /\bbill\b/i, /\blegislation\b/i, /\bcongress\b/i, /\bcommission\b/i, /\bact of\b/i, /\bincentive\b/i, /\bexpensing\b/i, /\bdepreciation\b/i, /\bsection 174\b/i, /\bh\.r\.\b/i, /\bs\.\b/i, /\bregulation\b/i, /\bregulatory\b/i] }
];

const POLICY_RULES = [
  { id: 'hr-7334-national-commission-robotics', keywords: [/\bh\.r\.\s*7334\b/i, /national commission on robotics/i] },
  { id: 'hr-8189-american-security-robotics', keywords: [/\bh\.r\.\s*8189\b/i, /american security robotics/i] },
  { id: 'obbba-bonus-depreciation', keywords: [/\bobbb\b/i, /\bobbba\b/i, /bonus depreciation/i, /100% depreciation/i] },
  { id: 'sec-174-rd-expensing', keywords: [/section 174/i, /174 expensing/i, /174 r&d/i, /r&d expensing/i] },
  { id: 'rd-tax-credit', keywords: [/r&d tax credit/i, /section 41/i] },
  { id: 'nist-ai-rmf', keywords: [/nist ai/i, /risk management framework/i, /ai rmf/i] },
  { id: 'chips-act-advanced-manufacturing', keywords: [/chips act/i, /chips and science/i] },
  { id: 'nsf-nri-3', keywords: [/nri 3\.0/i, /national robotics initiative/i] },
  { id: 'dod-replicator', keywords: [/replicator/i, /attritable autonomous/i] },
  { id: 'tx-robotics-investment', keywords: [/texas/i, /tx s\.b\.\s*1545/i] },
  { id: 'mi-mobility-r-d', keywords: [/michigan/i, /mi medc/i] },
  { id: 'pa-pittsburgh-robotics', keywords: [/pennsylvania/i, /pittsburgh robotics/i] },
  { id: 'nc-advanced-mfg', keywords: [/north carolina/i, /nc jdig/i] },
  { id: 'arpa-e-embodied-ai', keywords: [/arpa-e/i, /embodied ai for energy/i] },
  { id: 'ny-rd-credit', keywords: [/new york/i, /excelsior jobs/i] },
  { id: 'rfa-coalition-launch', keywords: [/robots for america/i, /scsp ai/i] },
  { id: 'ostp-ai-action-plan', keywords: [/america's ai action plan/i, /ai action plan/i, /ostp.*ai/i] },
  { id: 'doe-genesis-mission', keywords: [/genesis mission/i, /doe genesis/i] },
  { id: 'doe-exascale-foundry', keywords: [/exascale foundry/i] },
  { id: 'doc-eda-tech-hubs', keywords: [/eda tech hubs/i, /eda regional tech/i] },
  { id: 'nist-humanoid-benchmark', keywords: [/humanoid.*benchmark/i, /nist humanoid/i] },
  { id: 'nist-sp-1227-draft', keywords: [/sp 1227/i, /nist sp 1227/i] },
  { id: 'nsf-foundational-research-robotics', keywords: [/foundational research in robotics/i, /nsf foundational research/i] },
  { id: 'spaceforce-otter-contract', keywords: [/otter spacecraft/i, /otter contract/i] },
  { id: 'spaceforce-servicing-missions', keywords: [/satellite servicing missions/i, /on-orbit.*servicing/i] },
  { id: 'darpa-rsgs', keywords: [/rsgs/i, /robotic servicing of geosynchronous/i] },
  { id: 'usda-nsf-ai-institutes-ag', keywords: [/agaid\b/i, /aifarms\b/i, /agri.*ai institute/i] },
  { id: 'usda-nsf-ag-robotics', keywords: [/agricultural robotics partnership/i, /usda-nsf ag/i] },
  { id: 'nih-nibib-robotics-grants', keywords: [/nibib robotics/i, /surgical robotics.*nih/i] },
  { id: 'dot-av-uas-oversight', keywords: [/av and uas safety/i, /nhtsa.*safety/i, /faa.*safety/i] }
];

const AGENCY_RULES = [
  { id: 'ostp', keywords: [/office of science and technology policy/i, /\bostp\b/i] },
  { id: 'doe', keywords: [/department of energy/i, /\bdoe\b/i, /\blbnl\b/i, /\bornl\b/i, /\bpnnl\b/i, /\bargonne\b/i, /\bsandia\b/i, /\binl\b/i, /lawrence berkeley/i] },
  { id: 'arpa-e', keywords: [/advanced research projects agency\s*—*\s*energy/i, /\barpa-e\b/i] },
  { id: 'doc', keywords: [/department of commerce/i, /\bdoc\b/i, /bureau of industry and security/i, /\bbis\b/i] },
  { id: 'nist', keywords: [/national institute of standards/i, /\bnist\b/i] },
  { id: 'nsf', keywords: [/national science foundation/i, /\bnsf\b/i] },
  { id: 'nasa', keywords: [/national aeronautics and space administration/i, /\bnasa\b/i, /\bjpl\b/i] },
  { id: 'space-force', keywords: [/space force/i, /\bussf\b/i] },
  { id: 'darpa', keywords: [/defense advanced research projects agency/i, /\bdarpa\b/i] },
  { id: 'usda', keywords: [/department of agriculture/i, /\busda\b/i, /\bnifa\b/i] },
  { id: 'nih', keywords: [/national institutes of health/i, /\bnih\b/i, /\bnibib\b/i, /clinical center/i] },
  { id: 'dot', keywords: [/department of transportation/i, /\bdot\b/i, /\bnhtsa\b/i, /\bfaa\b/i] },
  { id: 'dod', keywords: [/department of defense/i, /\bdod\b/i, /pentagon/i] },
  { id: 'gsa', keywords: [/general services administration/i, /\bgsa\b/i] },
  { id: 'treasury', keywords: [/department of the treasury/i, /\btreasury\b/i] },
  { id: 'irs', keywords: [/internal revenue service/i, /\birs\b/i] },
  { id: 'diu', keywords: [/defense innovation unit/i, /\bdiu\b/i] },
  { id: 'dol', keywords: [/department of labor/i, /\bdol\b/i] },
  { id: 'tx-comptroller', keywords: [/texas comptroller/i] },
  { id: 'tx-gov', keywords: [/texas governor/i, /office of the texas governor/i] },
  { id: 'medc', keywords: [/michigan economic development/i, /\bmedc\b/i] },
  { id: 'pa-dced', keywords: [/pennsylvania department of community/i, /\bpa dced\b/i] },
  { id: 'nc-doc', keywords: [/north carolina department of commerce/i, /nc department of commerce/i] },
  { id: 'nc-eic', keywords: [/economic investment committee/i] },
  { id: 'esd', keywords: [/empire state development/i, /\besd\b/i] }
];

// Helper to check if text matches any regex in rules
function findMatches(text, rules) {
  const matchedIds = [];
  for (const rule of rules) {
    if (rule.keywords.some(regex => regex.test(text))) {
      matchedIds.push(rule.id);
    }
  }
  return matchedIds;
}

function deduplicate(arr) {
  return [...new Set(arr)];
}

function enrichNews() {
  const filePath = resolve(DATA_DIR, 'news.json');
  const news = JSON.parse(readFileSync(filePath, 'utf8'));

  // Read policies.json to prepare transitive theme inheritance mapping
  const policiesPath = resolve(DATA_DIR, 'policies.json');
  const policies = JSON.parse(readFileSync(policiesPath, 'utf8'));
  const policyThemesMap = new Map();
  for (const p of policies) {
    policyThemesMap.set(p.id, p.themes || []);
  }

  let updatedCount = 0;

  for (const item of news) {
    const searchString = `${item.title} ${item.summary || ''} ${item.category || ''}`.toLowerCase();
    
    const beforeStr = JSON.stringify({
      companies: item.companies,
      policies: item.policies,
      themes: item.themes
    });

    // Match companies
    const matchedComps = findMatches(searchString, COMPANY_RULES);
    item.companies = deduplicate([...(item.companies || []), ...matchedComps]);

    // Match policies
    const matchedPols = findMatches(searchString, POLICY_RULES);
    item.policies = deduplicate([...(item.policies || []), ...matchedPols]);

    // Inherit themes from linked policies (transitive)
    const inheritedThemes = [];
    for (const policyId of item.policies) {
      const themes = policyThemesMap.get(policyId) || [];
      inheritedThemes.push(...themes);
    }

    // Match themes
    const matchedThemes = findMatches(searchString, THEME_RULES);
    item.themes = deduplicate([...(item.themes || []), ...matchedThemes, ...inheritedThemes]);

    const afterStr = JSON.stringify({
      companies: item.companies,
      policies: item.policies,
      themes: item.themes
    });

    if (beforeStr !== afterStr) {
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    writeFileSync(filePath, JSON.stringify(news, null, 2));
    console.log(`Enriched ${updatedCount} news records.`);
  } else {
    console.log('No news records needed enrichment updates.');
  }
}

function enrichPolicies() {
  const filePath = resolve(DATA_DIR, 'policies.json');
  const policies = JSON.parse(readFileSync(filePath, 'utf8'));
  let updatedCount = 0;

  for (const item of policies) {
    // We search title + summary + sponsor + robotics_scope
    const searchString = `${item.title} ${item.summary || ''} ${item.sponsor || ''} ${item.robotics_scope || ''}`.toLowerCase();

    // Ensure themes array exists
    item.themes = item.themes || [];

    const beforeStr = JSON.stringify({
      agency_responsible: item.agency_responsible,
      tags: item.tags,
      themes: item.themes
    });

    // Clean / Map agency_responsible:
    // If the agency_responsible array currently contains verbose string names, let's translate them
    // and also find matches from the search text.
    let currentAgencies = [];
    if (Array.isArray(item.agency_responsible)) {
      for (const val of item.agency_responsible) {
        if (typeof val !== 'string' || !val) continue;
        // If it's already a valid ID, keep it.
        const ruleMatch = AGENCY_RULES.find(r => r.id === val.toLowerCase());
        if (ruleMatch) {
          currentAgencies.push(ruleMatch.id);
        } else {
          // If it's a verbose agency name, match it
          const valLower = val.toLowerCase();
          const matched = AGENCY_RULES.find(r => r.keywords.some(regex => regex.test(valLower)));
          if (matched) {
            currentAgencies.push(matched.id);
          }
        }
      }
    }

    // Now find any other agency matches in the text description
    const matchedAgencies = findMatches(searchString, AGENCY_RULES);
    item.agency_responsible = deduplicate([...currentAgencies, ...matchedAgencies]);

    // If policy is a tax provision or related to tax, ensure it has "tax" tag
    if (item.id === 'sec-174-rd-expensing' || item.id === 'rd-tax-credit' || item.id === 'obbba-bonus-depreciation' || searchString.includes(' tax ') || searchString.includes('expensing') || searchString.includes('depreciation')) {
      if (!item.tags.includes('tax')) {
        item.tags.push('tax');
      }
    }

    // Match themes
    const matchedThemes = findMatches(searchString, THEME_RULES);
    item.themes = deduplicate([...item.themes, ...matchedThemes]);

    const afterStr = JSON.stringify({
      agency_responsible: item.agency_responsible,
      tags: item.tags,
      themes: item.themes
    });

    if (beforeStr !== afterStr) {
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    writeFileSync(filePath, JSON.stringify(policies, null, 2));
    console.log(`Enriched ${updatedCount} policy records.`);
  } else {
    console.log('No policy records needed enrichment updates.');
  }
}

function main() {
  console.log('Running auto-enrichment on datasets...');
  enrichNews();
  enrichPolicies();
  console.log('Auto-enrichment complete.');
}

main();
