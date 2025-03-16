import { Plugin, TFile, Notice, App, PluginSettingTab, Setting } from 'obsidian';

interface GraphNode {
    id: string;
    group: string;
}

interface GraphEdge {
    source: string;
    target: string;
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

interface GraphToJsonSettings {
    targetDirectory: string;
}

const DEFAULT_SETTINGS: GraphToJsonSettings = {
    targetDirectory: ''
}

class GraphToJsonSettingTab extends PluginSettingTab {
    plugin: GraphToJsonPlugin;

    constructor(app: App, plugin: GraphToJsonPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'Graph to JSON Settings'});

        new Setting(containerEl)
            .setName('Target Directory')
            .setDesc('The directory to process cards from (relative to vault root)')
            .addText(text => text
                .setPlaceholder('Enter directory name')
                .setValue(this.plugin.settings.targetDirectory)
                .onChange(async (value) => {
                    this.plugin.settings.targetDirectory = value;
                    await this.plugin.saveData(this.plugin.settings);
                }));
    }
}

export default class GraphToJsonPlugin extends Plugin {
    settings: GraphToJsonSettings;

    async onload() {
        await this.loadSettings();

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

        // Add settings tab
        this.addSettingTab(new GraphToJsonSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async exportGraphToJson() {
        const app = this.app;
        const activeLeaf = app.workspace.activeLeaf;
        console.log('Active leaf:', activeLeaf);
        
        if (!activeLeaf) {
            new Notice('No active view found');
            return;
        }

        const viewState = activeLeaf.getViewState();
        console.log('View state:', viewState);
        
        if (viewState.type !== 'graph') {
            new Notice('Please open the Graph view first');
            return;
        }

        // Get all markdown files from target directory
        const allFiles = app.vault.getMarkdownFiles();
        const targetDir = this.settings.targetDirectory;
        const files = targetDir ? 
            allFiles.filter(file => file.path.startsWith(targetDir + '/')) :
            allFiles;
        console.log(`Processing files from ${targetDir || 'root'} folder:`, files.length);
        
        if (files.length === 0) {
            new Notice(`No files found in ${targetDir || 'root'} folder`);
            return;
        }

        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        // Create nodes
        for (const file of files) {
            // Get path relative to target directory
            const relativePath = targetDir ? file.path.replace(targetDir + '/', '') : file.path;
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

                if (targetFile && targetFile.extension === 'md' && 
                    (!targetDir || targetFile.path.startsWith(targetDir + '/'))) {
                    edges.push({
                        source: file.basename,
                        target: targetFile.basename
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
            new Notice('Graph data exported successfully to graph_data.json');
        } catch (error) {
            new Notice('Error exporting graph data: ' + error.message);
            console.error('Error exporting graph data:', error);
        }
    }
}