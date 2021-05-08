/// <reference path="./dragDropInterfacaces.ts" />
/// <reference path="./projectState.ts" />
/// <reference path="./projectModel.ts" />
/// <reference path="./validate.ts" />
/// <reference path="./autobindDecorator.ts" />

namespace App {

  abstract class Component<T extends HTMLElement, U extends HTMLElement> {
    templateElement: HTMLTemplateElement;
    hostElement: T;
    element: U;

    constructor(templateId: string, hostElementId: string, insertAtStart: boolean, newElementId?: string) {
      this.templateElement = document.getElementById(templateId)! as HTMLTemplateElement;
      this.hostElement = document.getElementById(hostElementId)! as T;
      // template内を複製
      const importedNode = document.importNode(this.templateElement.content, true);
      // 最初の子要素で初期化
      this.element = importedNode.firstElementChild as U;
      if (newElementId !== undefined) {
        this.element.id = newElementId;
      }
      this.attach(insertAtStart);
    }

    private attach(insertToStart: boolean) {
      this.hostElement.insertAdjacentElement(insertToStart ? 'afterbegin' : 'beforeend', this.element);
    }

    abstract configure(): void;
    abstract renderContent(): void;
  }

  class ProjectItem extends Component<HTMLUListElement, HTMLLIElement> implements Draggable {
    private project: Project;

    get manday() {
      const man = this.project.manday;
      if (this.project.manday < 20) {
        return man.toString() + '人日';
      }
      return (man / 20).toString() + '人月';
    }

    constructor(hostId: string, project: Project) {
      super("single-project", hostId, false, project.id);
      this.project = project;

      this.configure();
      this.renderContent();
    }

    @autobind
    dragStartHandler(event: DragEvent) {
      event.dataTransfer!.setData('text/plain', this.project.id);
      event.dataTransfer!.effectAllowed = 'move';
      console.log(event.dataTransfer!.getData('text/plain'))
    }

    dragEndHandler(_: DragEvent) {
    }

    configure() {
      this.element.addEventListener('dragstart', this.dragStartHandler);
      this.element.addEventListener('dragend', this.dragEndHandler);
    }

    renderContent() {
      this.element.querySelector('h2')!.textContent = this.project.title;
      this.element.querySelector('h3')!.textContent = this.manday;
      this.element.querySelector('p')!.textContent = this.project.description;
    }
  }


  class ProjectList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {
    assignedProjects: any[] = []

    constructor(private type: 'active' | 'finished') {
      super('project-list', 'app', false, `${type}-projects`);
      this.assignedProjects = [];

      this.configure();
      this.renderContent();
    }

    @autobind
    dragOverHandler(event: DragEvent) {
      if (event.dataTransfer && event.dataTransfer.types[0] === 'text/plain') {
        event.preventDefault();
        this.element.querySelector('ul')!.classList.add('droppable');
      }
    }

    @autobind
    dragLeaveHandler(_: DragEvent) {
      this.element.querySelector('ul')!.classList.remove('droppable');
    }

    dropHandler(event: DragEvent) {
      const prj = event.dataTransfer!.getData('text/plain');
      projectState.changeProjectState(prj, this.type === 'active' ? ProjectStatus.Active : ProjectStatus.Finished);
    }

    renderContent() {
      const listId = `${this.type}-projects-list`;
      this.element.querySelector('ul')!.id = listId;
      this.element.querySelector('h2')!.textContent =
        this.type === 'active' ? '実行中プロジェクト' : '完了プロジェクト';
    }


    configure() {
      this.element.addEventListener('dragover', this.dragOverHandler);
      this.element.addEventListener('drop', this.dropHandler);
      this.element.addEventListener('dragleave', this.dragLeaveHandler);

      projectState.addListener((projects: Project[]) => {
        const relevantProject = projects.filter(prj => {
          if (this.type === 'active') {
            return prj.status === ProjectStatus.Active;
          }
          return prj.status === ProjectStatus.Finished;
        })
        this.assignedProjects = relevantProject;
        this.renderProjects();
      });
    }

    private renderProjects() {
      const li = document.getElementById(`${this.type}-projects-list`) as HTMLUListElement;
      li.innerHTML = '';
      for (const prj of this.assignedProjects) {
        new ProjectItem(li.id, prj);
      }
    }
  }


  class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
    titleInputElement: HTMLInputElement;
    descriptionInputElement: HTMLInputElement;
    mandayInputElement: HTMLInputElement;

    constructor() {
      super('project-input', 'app', true, 'user-input');

      this.titleInputElement = this.element.querySelector('#title')! as HTMLInputElement
      this.descriptionInputElement = this.element.querySelector('#description')! as HTMLInputElement
      this.mandayInputElement = this.element.querySelector('#manday')! as HTMLInputElement

      this.configure();
    }

    configure() {
      this.element.addEventListener('submit', this.submitFunc)
    }

    renderContent() {

    }

    private gatherInputs(): [string, string, number] | void {
      const title = this.titleInputElement.value;
      const desc = this.descriptionInputElement.value;
      const man = this.mandayInputElement.value;
      if (!validate({ value: title, required: true, minLength: 2 }) ||
        !validate({ value: desc, required: true, minLength: 2 }) ||
        !validate({ value: man, required: true, min: 0, max: 100 })
      ) {
        alert('入力値が正しくありません');
        return;
      }
      return [title, desc, +man]
    }


    private clearInput() {
      this.titleInputElement.value = '';
      this.descriptionInputElement.value = '';
      this.mandayInputElement.value = '';
    }


    @autobind
    private submitFunc(event: Event) {
      event.preventDefault();

      const userInput = this.gatherInputs()
      if (Array.isArray(userInput)) {
        const [title, desc, man] = userInput;
        this.clearInput();
        projectState.addProject(title, desc, man);
      }
    }

  }

  new ProjectInput();
  new ProjectList('active');
  new ProjectList('finished');

}
