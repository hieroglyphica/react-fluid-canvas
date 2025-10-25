export class Pointer {
  constructor() {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    // default normalized RGB (0..1) sensible starting color (neutral grey)
    this.color = [0.3, 0.3, 0.3];
  }
}
