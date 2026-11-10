import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { AboutComponent } from '@components/about/about.component';

const routes: Routes = [
  {
    path: '',
    component: AboutComponent,
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class AboutRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    AboutRoutingModule,
  ],
  declarations: [
    AboutComponent,
  ],
})
export class AboutModule { }






