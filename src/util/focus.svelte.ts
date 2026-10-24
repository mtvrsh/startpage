export class FocusNavigator {
  index = 0;
  items: HTMLElement[] = $state([]);

  at(index: number) {
    const items = this.items.filter(item => item?.isConnected)

    if (!items.length) return

    this.index = ((index % items.length) + items.length) % items.length;
    items[this.index].focus();
  };

  current() {
    this.at(this.index);
  };

  prev() {
    this.at(this.index - 1);
  };

  next() {
    this.at(this.index + 1);
  };
};
