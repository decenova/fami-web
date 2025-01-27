import {Injectable} from "@angular/core";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {catchError, tap} from "rxjs/operators";
import {BehaviorSubject, throwError} from 'rxjs';
import {User} from "./user.model";
import {Router} from "@angular/router";

import { environment } from "../../environments/environment";


export interface AuthResponseData{
  idToken: string,
  email: string,
  refreshToken: string,
  expiresIn: string,
  localId: string,
  registered: boolean
}

@Injectable({providedIn: 'root'})
export class AuthService{

  user = new BehaviorSubject<User>(null);
  private tokenExpirationTimer: any;

  constructor(private http: HttpClient, private router: Router) {
  }

  signup(email: string, password: string){
    return this.http.post<AuthResponseData>(
      environment.firebaseAPISignup+environment.firebaseAPIKey,
      {
        email: email,
        password: password,
        returnSecureToken: true
      })
      .pipe(catchError(this.handleError),tap(resData =>{
        this.handleAuthentication(
          resData.email,
          resData.localId,
          resData.idToken,
          +resData.expiresIn)
      }))
  }
  autoLogin(){
    const userData: {
      email: string;
      id: string;
      _token: string;
      _tokenExpirationDate: string;
    } = JSON.parse(localStorage.getItem('userData'));
    if(!userData){
      return;
    }
    const loadedUser = new User(
      userData.email,
      userData.id,
      userData._token,
      new Date(userData._tokenExpirationDate));

    if(loadedUser.token){
      this.user.next(loadedUser);
      const expirationDuration = new Date(userData._tokenExpirationDate).getTime() - new Date().getTime();
      this.autoLogout(expirationDuration);
    }
  }

  signin(email: string, password: string){
    return this.http.post<AuthResponseData>(
      environment.firebaseAPISignin+environment.firebaseAPIKey,
      {
        email: email,
        password: password,
        returnSecureToken: true
      }).pipe(catchError(this.handleError),tap(resData =>{
      this.handleAuthentication(
        resData.email,
        resData.localId,
        resData.idToken,
        +resData.expiresIn)}))
  }

  autoLogout(expirationDuration: number){
    this.tokenExpirationTimer = setTimeout(()=>{
      this.logout();
    }, expirationDuration);

  }

  logout(){
    this.user.next(null);
    this.router.navigate(['/auth']);
    localStorage.removeItem('userData');
    if(this.tokenExpirationTimer){
      clearTimeout(this.tokenExpirationTimer);
    }
    this.tokenExpirationTimer = null;
  }

  private handleAuthentication(
    email: string,
    userId: string,
    token: string,
    expiresIn: number ){
    const expirationDate = new Date(new Date().getTime() + expiresIn*1000);
    const user = new User(
      email,
      userId,
      token,
      expirationDate);
    this.user.next(user);
    this.autoLogout(expiresIn*1000);
    localStorage.setItem('userData',JSON.stringify(user));
  }

  private handleError(errorRes: HttpErrorResponse){
    let erMessage = 'An error occured!';
    if(!errorRes.error || !errorRes.error.error){
      return throwError(erMessage);
    }
    switch (errorRes.error.error.message)
    {
      case 'EMAIL_EXISTS':
        erMessage = 'The email address is already in use by another account.'
        break;
      case 'EMAIL_NOT_FOUND':
        erMessage = 'There is no user record corresponding to this identifier. The user may have been deleted.'
        break;
      case 'USER_DISABLED':
        erMessage = 'The user account has been disabled by an administrator.'
        break;
      case 'INVALID_PASSWORD':
        erMessage = 'The password is invalid or the user does not have a password.'
        break;
      default:
        erMessage = errorRes.error.error.message;
    }

    return throwError(erMessage);
  }

}
