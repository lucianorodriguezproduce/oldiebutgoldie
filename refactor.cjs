const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
    // Top-level moves
    { prev: /TEXTS\.navigation/g, next: 'TEXTS.global.navigation' },
    { prev: /TEXTS\.badges/g, next: 'TEXTS.global.badges' },
    { prev: /TEXTS\.success/g, next: 'TEXTS.global.success' },
    { prev: /TEXTS\.common\.batchReview/g, next: 'TEXTS.revisarLote.batchReview' },
    { prev: /TEXTS\.common\.publicActivity/g, next: 'TEXTS.comercio.publicActivity' },
    { prev: /TEXTS\.common\.events/g, next: 'TEXTS.eventos.events' },
    { prev: /TEXTS\.common/g, next: 'TEXTS.global.common' },
    { prev: /TEXTS\.showcase/g, next: 'TEXTS.home.showcase' },
    { prev: /TEXTS\.item/g, next: 'TEXTS.album.item' },
    { prev: /TEXTS\.details/g, next: 'TEXTS.album.details' },
    { prev: /TEXTS\.negotiation/g, next: 'TEXTS.perfil.negotiation' },
    { prev: /TEXTS\.profile/g, next: 'TEXTS.perfil.profile' },
    { prev: /TEXTS\.admin/g, next: 'TEXTS.admin.admin' },
    { prev: /TEXTS\.bulk/g, next: 'TEXTS.admin.bulk' },
    { prev: /TEXTS\.activity/g, next: 'TEXTS.comercio.activity' },
    { prev: /TEXTS\.auth/g, next: 'TEXTS.login.auth' },
    { prev: /TEXTS\.gatekeeper/g, next: 'TEXTS.login.gatekeeper' },

    // Flat community keys
    { prev: /TEXTS\.syncingEditorial/g, next: 'TEXTS.comunidad.syncingEditorial' },
    { prev: /TEXTS\.transmissionProtocolEstablished/g, next: 'TEXTS.comunidad.transmissionProtocolEstablished' },
    { prev: /TEXTS\.connectionError/g, next: 'TEXTS.comunidad.connectionError' },
    { prev: /TEXTS\.culturalArchiveEmpty/g, next: 'TEXTS.comunidad.culturalArchiveEmpty' },
    { prev: /TEXTS\.nextSyncCycle/g, next: 'TEXTS.comunidad.nextSyncCycle' },
    { prev: /TEXTS\.featured/g, next: 'TEXTS.comunidad.featured' },
    { prev: /TEXTS\.novelty/g, next: 'TEXTS.comunidad.novelty' },
    { prev: /TEXTS\.analyst/g, next: 'TEXTS.comunidad.analyst' },
    { prev: /TEXTS\.readArticle/g, next: 'TEXTS.comunidad.readArticle' },
    { prev: /TEXTS\.intelDispatches/g, next: 'TEXTS.comunidad.intelDispatches' },
    { prev: /TEXTS\.monthlyMetadata/g, next: 'TEXTS.comunidad.monthlyMetadata' },
    { prev: /TEXTS\.all/g, next: 'TEXTS.comunidad.all' },
    { prev: /TEXTS\.interviews/g, next: 'TEXTS.comunidad.interviews' },
    { prev: /TEXTS\.culture/g, next: 'TEXTS.comunidad.culture' },
    { prev: /TEXTS\.equipment/g, next: 'TEXTS.comunidad.equipment' },
    { prev: /TEXTS\.seeNote/g, next: 'TEXTS.comunidad.seeNote' },
    { prev: /TEXTS\.newsDesk/g, next: 'TEXTS.comunidad.newsDesk' },
    { prev: /TEXTS\.joinProtocol/g, next: 'TEXTS.comunidad.joinProtocol' },
    { prev: /TEXTS\.highFidelityDespatches/g, next: 'TEXTS.comunidad.highFidelityDespatches' },
    { prev: /TEXTS\.terminalID/g, next: 'TEXTS.comunidad.terminalID' },
    { prev: /TEXTS\.linking/g, next: 'TEXTS.comunidad.linking' },
    { prev: /TEXTS\.initialize/g, next: 'TEXTS.comunidad.initialize' },
    { prev: /TEXTS\.encryptedVia/g, next: 'TEXTS.comunidad.encryptedVia' },
    { prev: /TEXTS\.loadingArticle/g, next: 'TEXTS.comunidad.loadingArticle' },
    { prev: /TEXTS\.articleNotFound/g, next: 'TEXTS.comunidad.articleNotFound' },
    { prev: /TEXTS\.backToEditorial/g, next: 'TEXTS.comunidad.backToEditorial' },
    { prev: /TEXTS\.author/g, next: 'TEXTS.comunidad.author' },
    { prev: /TEXTS\.readingTime/g, next: 'TEXTS.comunidad.readingTime' },
    { prev: /TEXTS\.share/g, next: 'TEXTS.comunidad.share' },
    { prev: /TEXTS\.endOfDispatch/g, next: 'TEXTS.comunidad.endOfDispatch' },
    { prev: /TEXTS\.stayTuned/g, next: 'TEXTS.comunidad.stayTuned' },
    { prev: /TEXTS\.exploreOtherArticles/g, next: 'TEXTS.comunidad.exploreOtherArticles' },
    { prev: /TEXTS\.sonicConnectionLost/g, next: 'TEXTS.comunidad.sonicConnectionLost' },
    { prev: /TEXTS\.backToDiscovery/g, next: 'TEXTS.comunidad.backToDiscovery' },
    { prev: /TEXTS\.syncToCollect/g, next: 'TEXTS.comunidad.syncToCollect' },
    { prev: /TEXTS\.syncToWantlist/g, next: 'TEXTS.comunidad.syncToWantlist' },
    { prev: /TEXTS\.archivingCollection/g, next: 'TEXTS.comunidad.archivingCollection' },
    { prev: /TEXTS\.removingCollection/g, next: 'TEXTS.comunidad.removingCollection' },
    { prev: /TEXTS\.searchingFavorites/g, next: 'TEXTS.comunidad.searchingFavorites' },
    { prev: /TEXTS\.removingFavorites/g, next: 'TEXTS.comunidad.removingFavorites' },
    { prev: /TEXTS\.archived/g, next: 'TEXTS.comunidad.archived' },
    { prev: /TEXTS\.collect/g, next: 'TEXTS.comunidad.collect' },
    { prev: /TEXTS\.target/g, next: 'TEXTS.comunidad.target' },
    { prev: /TEXTS\.favorites/g, next: 'TEXTS.comunidad.favorites' },
    { prev: /TEXTS\.transmissionLink/g, next: 'TEXTS.comunidad.transmissionLink' },
    { prev: /TEXTS\.marketLogic/g, next: 'TEXTS.comunidad.marketLogic' },
    { prev: /TEXTS\.basePrice/g, next: 'TEXTS.comunidad.basePrice' },
    { prev: /TEXTS\.resonance/g, next: 'TEXTS.comunidad.resonance' },
    { prev: /TEXTS\.communityVotes/g, next: 'TEXTS.comunidad.communityVotes' },
    { prev: /TEXTS\.analyzeOnDiscogs/g, next: 'TEXTS.comunidad.analyzeOnDiscogs' },
    { prev: /TEXTS\.lp/g, next: 'TEXTS.comunidad.lp' },
    { prev: /TEXTS\.eliteFavorite/g, next: 'TEXTS.comunidad.eliteFavorite' },
    { prev: /TEXTS\.label/g, next: 'TEXTS.comunidad.label' },
    { prev: /TEXTS\.catNo/g, next: 'TEXTS.comunidad.catNo' },
    { prev: /TEXTS\.genre/g, next: 'TEXTS.comunidad.genre' },
    { prev: /TEXTS\.country/g, next: 'TEXTS.comunidad.country' },
    { prev: /TEXTS\.tracklist/g, next: 'TEXTS.comunidad.tracklist' },
    { prev: /TEXTS\.totalTracks/g, next: 'TEXTS.comunidad.totalTracks' },
    { prev: /TEXTS\.sonicSpectrum/g, next: 'TEXTS.comunidad.sonicSpectrum' },
    { prev: /TEXTS\.ownershipData/g, next: 'TEXTS.comunidad.ownershipData' },
    { prev: /TEXTS\.collectors/g, next: 'TEXTS.comunidad.collectors' },
    { prev: /TEXTS\.wanted/g, next: 'TEXTS.comunidad.wanted' },
];

function walkSync(currentDirPath, callback) {
    const fs = require('fs'), path = require('path');
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

let modifiedCount = 0;

walkSync(srcDir, function (filePath) {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let initialContent = content;

        replacements.forEach(({ prev, next }) => {
            content = content.replace(prev, next);
        });

        if (initialContent !== content) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated: ${filePath}`);
            modifiedCount++;
        }
    }
});

console.log(`Refactor complete. Modified ${modifiedCount} files.`);
