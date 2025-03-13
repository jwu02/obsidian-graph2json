import { Plugin, TFile } from 'obsidian';

interface GraphNode {
    id: string;
    group: string;
}

interface GraphEdge {
    from: string;
    to: string;
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export default class GraphToJsonPlugin extends Plugin {
    async onload() {
        // Add a ribbon icon
        this.addRibbonIcon('graph', 'Export Graph to JSON', () => {
            this.exportGraphToJson();
        });

        // Add a command
        this.addCommand({
            id: 'export-graph-to-json',
            name: 'Export Graph to JSON',
            callback: () => {
                this.exportGraphToJson();
            }
        });
    }

    async exportGraphToJson() {
        const app = this.app;
        const activeLeaf = app.workspace.activeLeaf;
        console.log('Active leaf:', activeLeaf);
        
        if (!activeLeaf) {
            console.error('No active leaf found');
            return;
        }

        const viewState = activeLeaf.getViewState();
        console.log('View state:', viewState);
        
        if (viewState.type !== 'graph') {
            console.error('No graph view is active. Please open the Graph view first (View -> Graph).');
            console.error('Current view type:', viewState.type);
            return;
        }

        // Get all markdown files from CardsPublic folder
        const allFiles = app.vault.getMarkdownFiles();
        const files = allFiles.filter(file => file.path.startsWith('CardsPublic/'));
        console.log('Processing files from CardsPublic folder:', files.length);
        
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        // Create nodes
        for (const file of files) {
            const relativePath = app.vault.getResourcePath(file);
            const directory = relativePath.split('/').slice(0, -1).join('/');
            const id = file.basename;

            nodes.push({
                id,
                group: directory
            });
        }

        // Get links between files
        for (const file of files) {
            const content = await app.vault.read(file);
            const links = content.match(/\[\[(.*?)\]\]/g) || [];

            for (const link of links) {
                const targetPath = link.slice(2, -2);
                const targetFile = app.metadataCache.getFirstLinkpathDest(targetPath, file.path);

                if (targetFile && targetFile.extension === 'md' && targetFile.path.startsWith('CardsPublic/')) {
                    edges.push({
                        from: file.basename,
                        to: targetFile.basename
                    });
                }
            }
        }

        // Create the final graph data
        const graphData: GraphData = {
            nodes,
            edges
        };

        // Convert to JSON and save
        const jsonContent = JSON.stringify(graphData, null, 2);
        const jsonPath = 'graph_data.json';

        try {
            const existingFile = app.vault.getAbstractFileByPath(jsonPath);
            if (existingFile) {
                await app.vault.modify(existingFile as TFile, jsonContent);
            } else {
                await app.vault.create(jsonPath, jsonContent);
            }
            console.log('Graph data exported successfully to graph.json');
        } catch (error) {
            console.error('Error exporting graph data:', error);
        }
    }
}