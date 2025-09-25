import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GatchaPage } from './gatcha.page';

describe('GatchaPage', () => {
  let component: GatchaPage;
  let fixture: ComponentFixture<GatchaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GatchaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
