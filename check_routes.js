const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src/server/routes');
const pagesDir = path.join(__dirname, 'frontend/src/pages');

const menuItems = [
  { name: 'Dashboard', page: 'Dashboard.tsx' },
  { name: 'Inbox', page: 'InboxPage.tsx', api: ['/api/captures'] },
  { name: 'Chat', page: 'ChatPage.tsx', api: ['/api/messages'] },
  { name: 'Agenda', page: 'AgendaPage.tsx', api: ['/api/calendar'] },
  { name: 'Projetos', page: 'ProjectsPage.tsx', api: ['/api/projects'] },
  { name: 'Agentes', page: 'AgentsPage.tsx', api: ['/api/agents'] },
  { name: 'Skills', page: 'SkillsPage.tsx', api: ['/api/skills'] },
  { name: 'Reuniões', page: 'MeetingsPage.tsx', api: ['/api/meetings'] },
  { name: 'Inteligência', page: 'LearningDashboard.tsx', api: ['/api/briefing'] },
  { name: 'Favoritos', page: 'FavoritesPage.tsx', api: ['/api/favorites'] },
  { name: 'Conhecimento', page: 'KnowledgePage.tsx', api: ['/api/memory', '/api/knowledge'] },
  { name: 'Arquivo', page: 'ArchivePage.tsx', api: ['/api/archive'] },
  { name: 'Configurações', page: 'SettingsPage.tsx', api: ['/api/settings'] },
];

for (const item of menuItems) {
  const pagePath = path.join(pagesDir, item.page);
  const exists = fs.existsSync(pagePath);
  console.log(`\n--- ${item.name} ---`);
  console.log(`Page ${item.page}: ${exists ? 'EXISTS' : 'MISSING'}`);
  
  if (exists && item.api) {
    const content = fs.readFileSync(pagePath, 'utf8');
    for (const api of item.api) {
      console.log(`Uses ${api}: ${content.includes(api) ? 'YES' : 'NO'}`);
    }
  }
}
