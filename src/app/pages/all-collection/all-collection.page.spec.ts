import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AllCollectionPage } from './all-collection.page';

describe('AllCollectionPage', () => {
  let component: AllCollectionPage;
  let fixture: ComponentFixture<AllCollectionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AllCollectionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
