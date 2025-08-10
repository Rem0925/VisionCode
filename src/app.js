// app.js (Completo, Refactorizado y sin omisiones)

class Workspace {
    constructor(wrapperElement, contentElement, zoomLevelDisplay) {
        this.wrapper = wrapperElement;
        this.content = contentElement;
        this.zoomDisplay = zoomLevelDisplay;

        this.scale = 1;
        this.panX = 0;
        this.panY = 0;

        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.init();
    }

    init() {
        this.wrapper.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.wrapper.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.updateTransform();
    }

    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) { // Zoom
            this.panX -= e.deltaX;
            this.panY -= e.deltaY;
            this.updateTransform();
        } else { // Pan con rueda
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoom(this.scale + delta);            
        }
    }

    handleMouseDown(e) {
         // 1. Verificamos si hay bloques en el área de trabajo.
        // Usamos el `content` (el div #workspace-content) para buscar.
        const hasBlocks = this.content.querySelector('.workspace-block');

        // 2. Si NO hay bloques (hasBlocks es null), simplemente no hacemos nada.
        // Esto previene que el paneo se active en un lienzo vacío.
        if (!hasBlocks) {
            return;
        }
        const targetTag = e.target.tagName.toUpperCase();
        if (targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'BUTTON' || targetTag === 'TEXTAREA') {
            return;
        }

        // Ignorar si el clic fue dentro de un bloque.
        if (e.target.closest('.workspace-block')) {
            return;
        }

        // Si pasamos todos los filtros, iniciamos el paneo.
        if (e.button === 0 || e.button === 1) { // Click izquierdo o central
            this.isPanning = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.wrapper.style.cursor = 'grabbing';
        }
     }

    handleMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.panX += dx;
            this.panY += dy;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.updateTransform();
        }
    }

    handleMouseUp() {
        this.isPanning = false;
        this.wrapper.style.cursor = 'grab';
    }
     
    zoom(newScale) {
        this.scale = Math.max(0.3, Math.min(2, newScale));
        this.updateTransform();
    }

    zoomIn() { this.zoom(this.scale + 0.1); }
    zoomOut() { this.zoom(this.scale - 0.1); }
    zoomReset() {
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
    }

    updateTransform() {
        this.content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        if(this.zoomDisplay) {
           this.zoomDisplay.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }
}

class BlockEditor {
    constructor(toolboxEl, workspaceContentEl, consoleOutputEl, codePreviewEl, runBtn, clearConsoleBtn, clearWorkspaceBtn) {
        this.toolbox = toolboxEl;
        this.workspaceContent = workspaceContentEl;
        this.consoleOutput = consoleOutputEl;
        this.codePreviewEl = codePreviewEl;
        this.emptyWorkspaceMessage = this.workspaceContent.querySelector(".empty-workspace");

        // Elementos de la consola
        this.consoleInputArea = document.getElementById("console-input-area");
        this.consoleInputField = document.getElementById("console-input-field");
        this.consolePromptPrefix = document.getElementById("console-prompt-prefix");

        // Estado interno
        this.draggedElement = null;
        this.isDraggingValueBlock = false;
        this.currentInputElementResolver = null;
        this.nextBlockId = 1;

        // Botones
        this.runButton = runBtn;
        this.clearConsoleButton = clearConsoleBtn;
        this.clearWorkspaceButton = clearWorkspaceBtn;
        
        this.init();
    }

    init() {
        this.setupToolbox();
        this.setupWorkspace();
        this.bindButtons();
        this.updateCodePreview();
    }
    
    setupToolbox() {
        this.toolbox.querySelectorAll(".block-template").forEach(block => this.setupDragEvents(block));
        document.querySelectorAll(".toolbox-section h3").forEach(header => {
            header.addEventListener("click", () => header.parentElement.classList.toggle("collapsed"));
        });
        const collapseAllBtn = document.getElementById("collapse-all-btn");
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener("click", () => {
                const sections = this.toolbox.querySelectorAll(".toolbox-section");
                const isAnythingExpanded = Array.from(sections).some(s => !s.classList.contains('collapsed'));
                
                sections.forEach(s => s.classList.toggle("collapsed", isAnythingExpanded));
                
                const icon = collapseAllBtn.querySelector("i");
                icon.className = isAnythingExpanded ? "fas fa-chevron-down" : "fas fa-chevron-up";
            });
        }
    }

    setupWorkspace() {
        this.setupDropEvents(this.workspaceContent);
    }

    bindButtons() {
        this.clearWorkspaceButton.addEventListener("click", () => {
            if (confirm("¿Estás seguro de que quieres limpiar el área de trabajo?")) {
                this.workspaceContent.innerHTML = "";
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-workspace';
                emptyMsg.innerHTML = `<i class="fas fa-hand-point-left"></i><p>Arrastra bloques aquí para comenzar</p>`;
                this.workspaceContent.appendChild(emptyMsg);
                this.emptyWorkspaceMessage = emptyMsg;
                if (window.app && window.app.workspace) {
                window.app.workspace.zoomReset();
            }
                this.appendToConsole("Área de trabajo limpiada.", "success");
            }
        });
        this.clearConsoleButton.addEventListener("click", () => this.consoleOutput.innerHTML = "");
        this.runButton.addEventListener("click", () => this.runExecution());
        this.consoleInputField.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && this.currentInputElementResolver) {
                const value = this.consoleInputField.value;
                this.consoleInputArea.style.display = "none";
                this.appendToConsole(this.consolePromptPrefix.textContent + value, "input");
                this.currentInputElementResolver(value);
                this.currentInputElementResolver = null;
            }
        });
    }

    setupDragEvents(element) {
        element.addEventListener("dragstart", (event) => {
            this.draggedElement = element;
            event.dataTransfer.setData("text/type", element.dataset.type);
            event.dataTransfer.setData("text/classes", element.className);
            event.dataTransfer.effectAllowed = "copy";
            element.classList.add("dragging");
            this.isDraggingValueBlock = element.classList.contains("value-block");
            if (this.emptyWorkspaceMessage) this.emptyWorkspaceMessage.style.display = "none";
        });
        element.addEventListener("dragend", () => {
            if (this.draggedElement) this.draggedElement.classList.remove("dragging");
            this.draggedElement = null;
            this.isDraggingValueBlock = false;
            document.querySelectorAll(".drag-over, .drag-over-socket, .drag-over-container").forEach(el => {
                el.classList.remove("drag-over", "drag-over-socket", "drag-over-container");
            });
        });
    }

    setupDropEvents(element) {
        element.addEventListener("dragover", (event) => {
            event.preventDefault();
            const target = event.target.closest(".input-socket, .statement-container, #workspace-content");
            if (!target || !this.draggedElement) return;

            document.querySelectorAll(".drag-over-socket, .drag-over-container").forEach(el => el.classList.remove("drag-over-socket", "drag-over-container"));
            this.workspaceContent.classList.remove("drag-over");
            
            const blockType = this.draggedElement.dataset.type;
            const accepts = target.dataset.accepts;

            let canDrop = false;
            if (target.classList.contains("input-socket") && this.isDraggingValueBlock) {
                 if (accepts === "value" || 
                    (accepts === "boolean" && ["literal_boolean", "op_comparison", "op_logical", "op_not", "variable_get"].includes(blockType)) ||
                    (accepts === "number" && ["literal_number", "op_arithmetic", "variable_get"].includes(blockType)))
                {
                    target.classList.add("drag-over-socket");
                    canDrop = true;
                }
            } else if ((target.classList.contains("statement-container") || target.id === "workspace-content") && !this.isDraggingValueBlock) {
                 if (target.classList.contains("statement-container")) target.classList.add("drag-over-container");
                 else target.classList.add("drag-over");
                 canDrop = true;
            }
            
            event.dataTransfer.dropEffect = canDrop ? "copy" : "none";
        });

        element.addEventListener("dragleave", (event) => {
            const target = event.target.closest(".input-socket, .statement-container, #workspace-content");
            if (target) {
                target.classList.remove("drag-over-socket", "drag-over-container", "drag-over");
            }
        });

        element.addEventListener("drop", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const targetDropZone = event.target.closest(".input-socket, .statement-container, #workspace-content");
            if (!targetDropZone || !this.draggedElement) return;

            targetDropZone.classList.remove("drag-over-socket", "drag-over-container", "drag-over");

            const newBlock = this.draggedElement.cloneNode(true);
            newBlock.className = event.dataTransfer.getData("text/classes").replace("dragging", "").trim() + " workspace-block";
            newBlock.classList.remove("block-template");
            newBlock.id = `block-${this.nextBlockId++}`;

            newBlock.querySelectorAll("input, select").forEach(inp => {
                inp.addEventListener("click", e => e.stopPropagation());
                const original = Array.from(this.draggedElement.querySelectorAll("input, select")).find(orig => orig.className === inp.className || (orig.placeholder && orig.placeholder === inp.placeholder));
                if (original) inp.value = original.value;
            });
            
            newBlock.querySelectorAll(".input-socket, .statement-container").forEach(el => this.setupDropEvents(el));

            if (!newBlock.classList.contains("value-block")) {
                this.addBlockControls(newBlock);
            }
            if (newBlock.dataset.type === "print_advanced") this.setupPrintAdvancedBlock(newBlock);
            if (newBlock.dataset.type === "read_multiple") this.setupReadMultipleBlock(newBlock);

            if (targetDropZone.classList.contains("input-socket") && this.isDraggingValueBlock) {
                targetDropZone.innerHTML = "";
                targetDropZone.appendChild(newBlock);
            } else if (targetDropZone.classList.contains("statement-container") || targetDropZone.id === "workspace-content") {
                targetDropZone.appendChild(newBlock);
            }

            if(this.emptyWorkspaceMessage) this.emptyWorkspaceMessage.style.display = "none";
            this.updateAllBlockControlsStates();
            this.updateCodePreview();
        });
    }

    setupPrintAdvancedBlock(blockElement, isLoaded = false) {
      const addSegmentBtn = blockElement.querySelector(".add-segment-btn");
      const segmentsContainer = blockElement.querySelector(".print-segments-container");

      if (!addSegmentBtn || !segmentsContainer) return;

      if (isLoaded && segmentsContainer.children.length > 0) {
        segmentsContainer.querySelectorAll(".input-socket").forEach(el => this.setupDropEvents(el));
        segmentsContainer.querySelectorAll(".add-segment-btn").forEach(btn => {
            if (btn.textContent === "X") btn.onclick = () => btn.parentElement.remove();
        });
        segmentsContainer.querySelectorAll(".segment-type-select").forEach(select => {
            const contentSpan = select.parentElement.querySelector(".segment-content");
            select.onchange = () => this.renderSegmentContent(contentSpan, select.value);
        });
        return;
      }

      addSegmentBtn.onclick = (e) => {
        e.stopPropagation();
        const segmentDiv = document.createElement("div");
        segmentDiv.className = "print-segment";

        const typeSelect = document.createElement("select");
        typeSelect.className = "block-select segment-type-select";
        typeSelect.innerHTML = `<option value="text">Texto</option><option value="value">Valor</option>`;

        const contentSpan = document.createElement("span");
        contentSpan.className = "segment-content";

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "X";
        removeBtn.className = "add-segment-btn";
        removeBtn.style.marginLeft = "5px";
        removeBtn.onclick = () => segmentDiv.remove();

        typeSelect.onchange = () => {
          this.renderSegmentContent(contentSpan, typeSelect.value);
        };

        segmentDiv.appendChild(typeSelect);
        segmentDiv.appendChild(contentSpan);
        segmentDiv.appendChild(removeBtn);
        segmentsContainer.appendChild(segmentDiv);
        this.renderSegmentContent(contentSpan, "text");
      };

      if (!isLoaded) {
        addSegmentBtn.click();
      }
    }

    renderSegmentContent(contentSpan, type) {
      contentSpan.innerHTML = "";
      if (type === "text") {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "block-input literal-text-input";
        input.placeholder = "Escribe texto aquí...";
        input.onclick = (e) => e.stopPropagation();
        contentSpan.appendChild(input);
      } else if (type === "value") {
        const socket = document.createElement("span");
        socket.className = "input-socket value-input";
        socket.dataset.accepts = "value";
        socket.textContent = "[valor]";
        this.setupDropEvents(socket);
        contentSpan.appendChild(socket);
      }
    }

    setupReadMultipleBlock(blockElement, isLoaded = false) {
      const addVarBtn = blockElement.querySelector(".add-var-field-btn");
      const varsContainer = blockElement.querySelector(".read-vars-container");

      if (!addVarBtn || !varsContainer) return;

      if (isLoaded && varsContainer.children.length > 0) {
        varsContainer.querySelectorAll(".add-segment-btn").forEach(btn => {
            if (btn.textContent === "X") btn.onclick = () => btn.parentElement.remove();
        });
        return;
      }

      addVarBtn.onclick = (e) => {
        e.stopPropagation();
        const varInputContainer = document.createElement("div");
        varInputContainer.style.display = "flex";
        varInputContainer.style.alignItems = "center";
        varInputContainer.style.gap = "8px";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "block-input var-name-multi";
        input.placeholder = `var${varsContainer.children.length + 1}`;
        input.onclick = (e) => e.stopPropagation();

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "X";
        removeBtn.className = "add-segment-btn";
        removeBtn.style.marginLeft = "5px";
        removeBtn.onclick = () => varInputContainer.remove();

        varInputContainer.appendChild(input);
        varInputContainer.appendChild(removeBtn);
        varsContainer.appendChild(varInputContainer);
      };
    }

    addBlockControls(blockElement) {
      const controlsDiv = document.createElement("div");
      controlsDiv.className = "block-controls";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "block-ctrl-btn delete-btn";
      deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
      deleteBtn.title = "Eliminar bloque";
      deleteBtn.onclick = () => {
        if (confirm("¿Estás seguro de que quieres eliminar este bloque?")) {
            blockElement.remove();
            this.updateAllBlockControlsStates();
            this.updateCodePreview();
            if (this.workspaceContent.querySelectorAll(".workspace-block").length === 0) {
              if (this.emptyWorkspaceMessage) this.emptyWorkspaceMessage.style.display = "block";
            if (window.app && window.app.workspace) {
                window.app.workspace.zoomReset();
            }
            }
        }
      };

      const moveUpBtn = document.createElement("button");
      moveUpBtn.className = "block-ctrl-btn move-up-btn";
      moveUpBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
      moveUpBtn.title = "Mover arriba";
      moveUpBtn.onclick = () => {
        if (blockElement.previousElementSibling && blockElement.previousElementSibling.classList.contains("workspace-block")) {
          blockElement.parentElement.insertBefore(blockElement, blockElement.previousElementSibling);
          this.updateAllBlockControlsStates();
          this.updateCodePreview();
        }
      };

      const moveDownBtn = document.createElement("button");
      moveDownBtn.className = "block-ctrl-btn move-down-btn";
      moveDownBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
      moveDownBtn.title = "Mover abajo";
      moveDownBtn.onclick = () => {
        if (blockElement.nextElementSibling) {
          blockElement.parentElement.insertBefore(blockElement, blockElement.nextElementSibling.nextSibling);
          this.updateAllBlockControlsStates();
          this.updateCodePreview();
        }
      };

      controlsDiv.appendChild(moveUpBtn);
      controlsDiv.appendChild(moveDownBtn);
      controlsDiv.appendChild(deleteBtn);
      blockElement.appendChild(controlsDiv);
    }
    
    updateCodePreview() {
        const blocksToConvert = Array.from(this.workspaceContent.children)
            .filter(el => el.classList.contains("workspace-block") && !el.classList.contains("value-block"));
        
        const startBlock = blocksToConvert.find(b => b.dataset.type === 'start');
        if (!startBlock) {
            this.codePreviewEl.textContent = "// Añade un bloque de 'Inicio' para empezar.";
            return;
        }

        let code = "function main() {\n";
        code += this.generateCodeForBlocks(blocksToConvert, '  ');
        code += "}\n";

        const endBlock = blocksToConvert.find(b => b.dataset.type === 'end');
        if (endBlock) {
            code += "main();";
        }
        
        this.codePreviewEl.textContent = code;
    }

    generateCodeForBlocks(blocks, indent) {
        let blockCode = "";
        let inRunnableSection = false;

        for (const block of blocks) {
            const type = block.dataset.type;
            if (type === 'start') {
                inRunnableSection = true;
                continue;
            }
            if (type === 'end') {
                inRunnableSection = false;
                continue;
            }
            if (inRunnableSection) {
                blockCode += this.generateCodeForBlock(block, indent);
            }
        }
        return blockCode;
    }

    generateCodeForBlock(block, indent) {
        if (!block) return "";
        const type = block.dataset.type;
        let code = "";

        switch (type) {
            case "print":
                const valSocket = block.querySelector('.input-socket');
                code = `${indent}console.log(${this.generateCodeForSocket(valSocket)});\n`;
                break;
            
            case "alert":
                const alertSocket = block.querySelector('.input-socket');
                code = `${indent}alert(\`[ALERTA] ${this.generateCodeForSocket(alertSocket, true)}\`);\n`;
                break;

            case "print_advanced":
                // Genera un string concatenando los segmentos
                const segments = block.querySelectorAll(".print-segment");
                let advPrint = [];
                segments.forEach(segment => {
                    const segmentType = segment.querySelector(".segment-type-select").value;
                    const contentElement = segment.querySelector(".segment-content");
                    if (segmentType === "text") {
                        advPrint.push(`"${contentElement.querySelector('input[type="text"]').value.replace(/"/g, '\\"')}"`);
                    } else if (segmentType === "value") {
                        const valueSocket = contentElement.querySelector(".input-socket");
                        advPrint.push(this.generateCodeForSocket(valueSocket));
                    }
                });
                code = `${indent}console.log(${advPrint.join(" + ") || '""'});\n`;
                break;

            case "variable_set":
                const varName = block.querySelector(".var-name").value.trim() || 'variable_sin_nombre';
                const valueSocket = block.querySelector('.input-socket');
                code = `${indent}let ${varName} = ${this.generateCodeForSocket(valueSocket)};\n`;
                break;

            case "read_input":
                const varNameRead = block.querySelector(".var-name").value.trim() || 'variable_sin_nombre';
                code = `${indent}${varNameRead} = prompt("Introduce valor para '${varNameRead}':");\n`;
                break;

            case "read_multiple":
                const varInputs = block.querySelectorAll(".read-vars-container .var-name-multi");
                const varNames = Array.from(varInputs).map(input => input.value.trim()).filter(Boolean);
                if (varNames.length > 0) {
                    code = `${indent}{\n`;
                    code += `${indent}  let _input = prompt("Introduce valores para (${varNames.join(", ")}), separados por espacio:");\n`;
                    code += `${indent}  let _vals = _input ? _input.split(/\\s+/) : [];\n`;
                    varNames.forEach((name, i) => {
                        code += `${indent}  let ${name} = _vals[${i}] || "";\n`;
                    });
                    code += `${indent}}\n`;
                }
                break;

            case "control_if_else":
            case "control_if":
                const condition = this.generateCodeForSocket(block.querySelector('.condition-input'));
                code = `${indent}if (${condition}) {\n`;
                const thenContainer = block.querySelector('[data-branch-name="then"]');
                code += this.generateCodeForBlocks(thenContainer.children, indent + '  ');
                code += `${indent}}\n`;

                if (type === "control_if_else") {
                    const elseContainer = block.querySelector('[data-branch-name="else"]');
                    code = code.slice(0, -1); // Quita el último salto de línea
                    code += ` else {\n`;
                    code += this.generateCodeForBlocks(elseContainer.children, indent + '  ');
                    code += `${indent}}\n`;
                }
                break;
            
            case "control_while":
                const whileCond = this.generateCodeForSocket(block.querySelector('.condition-input'));
                code = `${indent}while (${whileCond}) {\n`;
                const whileLoopContainer = block.querySelector('[data-branch-name="loop"]');
                code += this.generateCodeForBlocks(whileLoopContainer.children, indent + '  ');
                code += `${indent}}\n`;
                break;

            case "control_for":
                // Espera: nombre de variable, 3 sockets (inicio, fin, paso), y un contenedor de sentencias
                const loopVarName = block.querySelector(".var-name").value.trim() || "i";
                const sockets = block.querySelectorAll('.input-socket[data-accepts="number"]');
                const fromVal = this.generateCodeForSocket(sockets[0]);
                const toVal = this.generateCodeForSocket(sockets[1]);
                const stepVal = this.generateCodeForSocket(sockets[2]);
                const loopContainer = block.querySelector('[data-branch-name="loop"]');
                code = `${indent}for (let ${loopVarName} = ${fromVal}; ${stepVal} > 0 ? ${loopVarName} <= ${toVal} : ${loopVarName} >= ${toVal}; ${loopVarName} += ${stepVal}) {\n`;
                code += this.generateCodeForBlocks(loopContainer.children, indent + '  ');
                code += `${indent}}\n`;
                break;
        }
        return code;
    }

    generateCodeForSocket(socket, isStringContext = false) {
        if (!socket) return isStringContext ? "" : "undefined";

        const childBlock = socket.querySelector(".workspace-block.value-block");
        if (!childBlock) {
             const accepts = socket.dataset.accepts;
            if (isStringContext) return "";
            if (accepts === "boolean") return "false";
            if (accepts === "number") return "0";
            return "undefined";
        }

        const type = childBlock.dataset.type;
        switch (type) {
            case "literal_text":
                return `"${childBlock.querySelector(".literal-text-input").value.replace(/"/g, '\\"')}"`;
            case "literal_number":
                return childBlock.querySelector(".literal-number-input").value || "0";
            case "literal_boolean":
                return childBlock.querySelector(".boolean-value-select").value;
            case "variable_get":
                return childBlock.querySelector(".var-name").value.trim() || "undefined";
            case "op_arithmetic":
            case "op_comparison":
            case "op_logical":
                const sockets = childBlock.querySelectorAll(".input-socket");
                const op = childBlock.querySelector(".operator").value;
                const v1 = this.generateCodeForSocket(sockets[0]);
                const v2 = this.generateCodeForSocket(sockets[1]);
                return `(${v1} ${op} ${v2})`;
            case "op_not":
                const notSocket = childBlock.querySelector(".input-socket");
                return `!(${this.generateCodeForSocket(notSocket)})`;
        }
        return "undefined";
    }

    updateAllBlockControlsStates() {
        this.workspaceContent.querySelectorAll(".workspace-block:not(.value-block)").forEach(block => {
            if (block.parentElement.id === "workspace-content" || block.parentElement.classList.contains("statement-container")) {
                this.updateBlockControlsState(block);
            }
        });
    }

    updateBlockControlsState(blockElement) {
        const upBtn = blockElement.querySelector(".move-up-btn");
        const downBtn = blockElement.querySelector(".move-down-btn");
        if (!upBtn || !downBtn) return;
        const childrenInParent = Array.from(blockElement.parentElement.children).filter(c => c.classList.contains("workspace-block") && !c.classList.contains("value-block"));
        const currentIndex = childrenInParent.indexOf(blockElement);
        upBtn.disabled = currentIndex <= 0;
        downBtn.disabled = currentIndex >= childrenInParent.length - 1;
    }

    appendToConsole(message, type = "log") {
        const line = document.createElement("div");
        line.textContent = message;
        line.className = type;
        this.consoleOutput.appendChild(line);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }
    
    promptInConsole(promptMessage = "> ") {
      return new Promise((resolve) => {
        this.consolePromptPrefix.textContent = promptMessage;
        this.consoleInputArea.style.display = "flex";
        this.consoleInputField.value = "";
        this.consoleInputField.focus();
        this.currentInputElementResolver = resolve;
      });
    }

    async runExecution() {
        this.consoleOutput.innerHTML = "";
        const executionScope = {
            variables: {},
            consoleLog: (msg) => this.appendToConsole(String(msg), "log"),
            consoleAlert: (msg) => this.appendToConsole(String(msg), "alert-message"),
            promptUser: (promptMsg) => this.promptInConsole(promptMsg),
        };
        const blocksToExecute = Array.from(this.workspaceContent.children).filter(el => el.classList.contains("workspace-block") && !el.classList.contains("value-block"));
        const startBlock = blocksToExecute.find(b => b.dataset.type === "start");
        const endBlock = blocksToExecute.find(b => b.dataset.type === "end");
        
        if (!startBlock) return this.appendToConsole("Error: No se encontró el bloque de INICIO.", "error");
        if (!endBlock) return this.appendToConsole("Error: No se encontró el bloque de FIN.", "error");

        this.appendToConsole("--- Iniciando Ejecución ---", "log");
        try {
            const startIndex = blocksToExecute.indexOf(startBlock) + 1;
            const endIndex = blocksToExecute.indexOf(endBlock);

            if (startIndex > endIndex) {
                return this.appendToConsole("Error: El bloque de FIN no puede estar antes que el de INICIO.", "error");
            }
            if (startIndex === endIndex) {
                return this.appendToConsole("Advertencia: No hay bloques para ejecutar entre INICIO y FIN.", "log");
            }

            for (let i = startIndex; i < endIndex; i++) {
                if (this.currentInputElementResolver) {
                    this.appendToConsole("Ejecución interrumpida: esperando entrada.", "error");
                    return;
                }
                await this.executeBlock(blocksToExecute[i], executionScope);
            }
            this.appendToConsole("--- Ejecución Finalizada ---", "success");
        } catch (error) {
            this.appendToConsole(`ERROR DE EJECUCIÓN: ${error.message}`, "error");
            if (this.currentInputElementResolver) {
                this.currentInputElementResolver(null);
                this.currentInputElementResolver = null;
                this.consoleInputArea.style.display = "none";
            }
        }
    }
    
    async executeBlock(blockElement, scope) {
      if (!blockElement || !blockElement.classList.contains("workspace-block") || this.currentInputElementResolver) return;

      const type = blockElement.dataset.type;
      let localVars = scope.variables;

      switch (type) {
        case "print": {
          const valueToPrintSocket = blockElement.querySelector('.input-socket[data-accepts="value"]');
          const printValue = await this.evaluateSocket(valueToPrintSocket, scope);
          scope.consoleLog(printValue);
          break;
        }
        case "alert": {
          const valueToAlertSocket = blockElement.querySelector('.input-socket[data-accepts="value"]');
          const alertMessage = await this.evaluateSocket(valueToAlertSocket, scope);
          scope.consoleAlert(`[ALERTA] ${alertMessage}`);
          break;
        }
        case "print_advanced": {
          let outputString = "";
          const segments = blockElement.querySelectorAll(".print-segment");
          for (const segment of segments) {
            const segmentType = segment.querySelector(".segment-type-select").value;
            const contentElement = segment.querySelector(".segment-content");
            if (segmentType === "text") {
              outputString += contentElement.querySelector('input[type="text"]').value;
            } else if (segmentType === "value") {
              const valueSocket = contentElement.querySelector(".input-socket");
              outputString += await this.evaluateSocket(valueSocket, scope);
            }
          }
          scope.consoleLog(outputString);
          break;
        }
        case "variable_set": {
          const varNameSet = blockElement.querySelector(".var-name").value.trim();
          const valueToSetSocket = blockElement.querySelector('.input-socket[data-accepts="value"]');
          if (!varNameSet) throw new Error("Nombre de variable vacío en el bloque 'Variable'.");
          localVars[varNameSet] = await this.evaluateSocket(valueToSetSocket, scope);
          break;
        }
        case "read_input": {
          const varNameRead = blockElement.querySelector(".var-name").value.trim();
          if (!varNameRead) throw new Error("Nombre de variable vacío en el bloque 'Leer en var'.");
          const userInput = await scope.promptUser(`Introduzca valor para '${varNameRead}'> `);
          if (userInput === null && !this.currentInputElementResolver) throw new Error("Entrada de usuario cancelada.");
          localVars[varNameRead] = userInput;
          break;
        }
        case "read_multiple": {
            const varNameInputs = blockElement.querySelectorAll(".read-vars-container .var-name-multi");
            const varNames = Array.from(varNameInputs).map(input => input.value.trim()).filter(Boolean);
            if (varNames.length === 0) {
                scope.consoleLog("Advertencia: No se especificaron variables para 'Leer Múltiple'.");
                break;
            }
            const rawInput = await scope.promptUser(`Introduzca valores para (${varNames.join(', ')}) separados por espacios> `);
            if (rawInput === null && !this.currentInputElementResolver) throw new Error("Entrada de usuario cancelada.");
            const inputValues = rawInput.split(/\s+/);
            varNames.forEach((name, i) => {
                localVars[name] = inputValues[i] !== undefined ? inputValues[i] : "";
            });
            break;
        }
        case "control_if": {
          const conditionSocket = blockElement.querySelector(".condition-input");
          if (Boolean(await this.evaluateSocket(conditionSocket, scope))) {
            const thenContainer = blockElement.querySelector('[data-branch-name="then"]');
            for (const childBlock of thenContainer.children) {
              await this.executeBlock(childBlock, scope);
            }
          }
          break;
        }
        case "control_if_else": {
          const conditionSocket = blockElement.querySelector(".condition-input");
          if (Boolean(await this.evaluateSocket(conditionSocket, scope))) {
            const thenContainer = blockElement.querySelector('[data-branch-name="then"]');
            for (const childBlock of thenContainer.children) await this.executeBlock(childBlock, scope);
          } else {
            const elseContainer = blockElement.querySelector('[data-branch-name="else"]');
            for (const childBlock of elseContainer.children) await this.executeBlock(childBlock, scope);
          }
          break;
        }
        case "control_for": {
            const loopVarName = blockElement.querySelector(".var-name").value.trim();
            const sockets = blockElement.querySelectorAll('.input-socket[data-accepts="number"]');
            const fromVal = Number(await this.evaluateSocket(sockets[0], scope));
            const toVal = Number(await this.evaluateSocket(sockets[1], scope));
            const stepVal = Number(await this.evaluateSocket(sockets[2], scope));

            if (!loopVarName || isNaN(fromVal) || isNaN(toVal) || isNaN(stepVal) || stepVal === 0) {
                throw new Error("Parámetros inválidos en el bloque 'Repetir con'.");
            }
            const loopScope = { ...scope, variables: { ...scope.variables } };
            const loopContainer = blockElement.querySelector('[data-branch-name="loop"]');
            const children = Array.from(loopContainer.children);

            if (stepVal > 0) {
                for (let i = fromVal; i <= toVal; i += stepVal) {
                    if (this.currentInputElementResolver) break;
                    loopScope.variables[loopVarName] = i;
                    for (const childBlock of children) await this.executeBlock(childBlock, loopScope);
                }
            } else {
                for (let i = fromVal; i >= toVal; i += stepVal) {
                    if (this.currentInputElementResolver) break;
                    loopScope.variables[loopVarName] = i;
                    for (const childBlock of children) await this.executeBlock(childBlock, loopScope);
                }
            }
            break;
        }
        case "control_while": {
            const conditionSocket = blockElement.querySelector(".condition-input");
            const loopContainer = blockElement.querySelector('[data-branch-name="loop"]');
            const children = Array.from(loopContainer.children);

            while (Boolean(await this.evaluateSocket(conditionSocket, scope))) {
                if (this.currentInputElementResolver) break;
                for (const childBlock of children) {
                    if (this.currentInputElementResolver) break;
                    await this.executeBlock(childBlock, scope);
                }
            }
            break;
        }
      }
    }

    async evaluateSocket(socketElement, scope) {
        if (!socketElement || this.currentInputElementResolver) return undefined;

        const childBlock = socketElement.querySelector(".workspace-block.value-block");
        if (!childBlock) {
            const accepts = socketElement.dataset.accepts;
            if (accepts === "boolean") return false;
            if (accepts === "number") return 0;
            return undefined;
        }
      
        const type = childBlock.dataset.type;
        switch (type) {
            case "literal_text":
                return childBlock.querySelector(".literal-text-input").value;
            case "literal_number":
                return Number(childBlock.querySelector(".literal-number-input").value);
            case "literal_boolean":
                return childBlock.querySelector(".boolean-value-select").value === "true";
            case "variable_get": {
                const varNameGet = childBlock.querySelector(".var-name").value.trim();
                if (!varNameGet || !scope.variables.hasOwnProperty(varNameGet)) {
                    throw new Error(`Variable '${varNameGet || 'vacía'}' no definida.`);
                }
                return scope.variables[varNameGet];
            }
            case "op_arithmetic": {
                const sockets = childBlock.querySelectorAll(".input-socket");
                const op = childBlock.querySelector(".operator").value;
                const v1_raw = await this.evaluateSocket(sockets[0], scope);
                const v2_raw = await this.evaluateSocket(sockets[1], scope);
                const v1 = Number(v1_raw);
                const v2 = Number(v2_raw);
                if (isNaN(v1) || isNaN(v2)) throw new Error(`Operación aritmética inválida: '${v1_raw}' ${op} '${v2_raw}'.`);
                switch (op) {
                    case "+": return v1 + v2;
                    case "-": return v1 - v2;
                    case "*": return v1 * v2;
                    case "/": if (v2 === 0) throw new Error("División por cero."); return v1 / v2;
                    case "%": if (v2 === 0) throw new Error("Módulo por cero."); return v1 % v2;
                    default: throw new Error(`Operador aritmético desconocido: ${op}`);
                }
            }
            case "op_comparison": {
                const sockets = childBlock.querySelectorAll(".input-socket");
                const op = childBlock.querySelector(".operator").value;
                let v1 = await this.evaluateSocket(sockets[0], scope);
                let v2 = await this.evaluateSocket(sockets[1], scope);
                
                // Coerción a número para comparación, excepto para booleanos
                const n1 = Number(v1);
                const n2 = Number(v2);
                if (typeof v1 !== 'boolean' && typeof v2 !== 'boolean' && !isNaN(n1) && !isNaN(n2)) {
                    v1 = n1;
                    v2 = n2;
                }

                switch (op) {
                    case "==": return v1 == v2;
                    case "!=": return v1 != v2;
                    case "<": return v1 < v2;
                    case "<=": return v1 <= v2;
                    case ">": return v1 > v2;
                    case ">=": return v1 >= v2;
                    default: throw new Error(`Operador de comparación desconocido: ${op}`);
                }
            }
            case "op_logical": {
                const sockets = childBlock.querySelectorAll(".input-socket");
                const op = childBlock.querySelector(".operator").value;
                const v1 = Boolean(await this.evaluateSocket(sockets[0], scope));
                // Short-circuit evaluation
                if (op === '&&' && !v1) return false;
                if (op === '||' && v1) return true;
                const v2 = Boolean(await this.evaluateSocket(sockets[1], scope));
                switch (op) {
                    case "&&": return v1 && v2;
                    case "||": return v1 || v2;
                    default: throw new Error(`Operador lógico desconocido: ${op}`);
                }
            }
            case "op_not": {
                const socket = childBlock.querySelector(".input-socket");
                return !Boolean(await this.evaluateSocket(socket, scope));
            }
            default:
                throw new Error(`Tipo de bloque de valor desconocido: ${type}`);
        }
    }
}


class App {
    constructor() {
        this.initElectronAPIs();
        this.initWorkspace();
        this.initBlockEditor();
        this.initTabs();
    }

    initElectronAPIs() {
        if (window.electronAPI) {
            document.getElementById('minimize-btn').addEventListener('click', () => window.electronAPI.minimizeWindow());
            document.getElementById('maximize-btn').addEventListener('click', () => window.electronAPI.maximizeWindow());
            document.getElementById('close-btn').addEventListener('click', () => window.electronAPI.closeWindow());
            const maxIcon = document.querySelector('#maximize-btn i');
            if(maxIcon){
                window.electronAPI.onWindowMaximized(() => maxIcon.className = 'far fa-window-restore');
                window.electronAPI.onWindowUnmaximized(() => maxIcon.className = 'far fa-window-maximize');
            }
        }
    }

    initWorkspace() {
        const workspaceWrapper = document.getElementById('workspace-wrapper');
        const workspaceContent = document.getElementById('workspace-content');
        const zoomLevelDisplay = document.getElementById('zoom-level');
        this.workspace = new Workspace(workspaceWrapper, workspaceContent, zoomLevelDisplay);

        document.getElementById('zoom-in-btn').addEventListener('click', () => this.workspace.zoomIn());
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.workspace.zoomOut());
        document.getElementById('zoom-reset-btn').addEventListener('click', () => this.workspace.zoomReset());
    }

    initBlockEditor() {
        this.blockEditor = new BlockEditor(
            document.getElementById('toolbox'),
            document.getElementById('workspace-content'),
            document.getElementById('console-output'),
            document.querySelector('#code-preview-tab code'),
            document.getElementById('runButton'),
            document.getElementById('clearConsoleButton'),
            document.getElementById('clear-btn'),
        );
    }
    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTabId = button.dataset.tab;

                // Desactivar todas las pestañas y contenidos
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Activar la pestaña y el contenido seleccionados
                button.classList.add('active');
                document.getElementById(targetTabId).classList.add('active');
            });
        });
    }
}

// Iniciar la aplicación
document.addEventListener('DOMContentLoaded', () =>   window.app = new App());