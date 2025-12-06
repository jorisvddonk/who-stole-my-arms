export class WidgetCollector {
  private widgets: string[] = [];

  register(url: string) {
    this.widgets.push(url);
  }

  getWidgets(): string[] {
    return [...this.widgets];
  }
}

export const widgetCollector = new WidgetCollector();