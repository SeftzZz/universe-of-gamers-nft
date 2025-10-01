import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreatesPage } from './creates.page';

describe('CreatesPage', () => {
  let component: CreatesPage;
  let fixture: ComponentFixture<CreatesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CreatesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
