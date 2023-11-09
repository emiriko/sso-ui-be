import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { User } from 'src/common/entities';
import { ORG_CODE } from './constant';
import * as path from 'path';
import { LoginInterface } from 'src/common/interfaces';
import { TokenPayload } from 'src/common/dtos';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  public async getTest(): Promise<string> {
    return 'Hello World!';
  }

  public async getErrors(): Promise<string> {
    throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }

  public async login(ticket: string): Promise<LoginInterface> {
    const parser = new XMLParser();

    const { data } = await this.httpService.axiosRef.get(
      path.join(process.env.SSO_URL, 'serviceValidate'),
      {
        params: {
          ticket: ticket,
          service: `${process.env.APP_CLIENT}`,
        },
      },
    );

    const {
      'cas:serviceResponse': { 'cas:authenticationSuccess': user_data },
    } = parser.parse(data);

    const {
      'cas:user': username,
      'cas:attributes': {
        'cas:nama': name,
        'cas:npm': npm,
        'cas:kd_org': org_code,
      },
    } = user_data;

    const student_org = ORG_CODE.id[org_code];

    let user: User;

    user = await this.userRepository.findOneBy({
      username: username,
    })

    if (!!!user) {
      user = await this.userRepository.save({
        name: name,
        npm: npm,
        username: username,
        ...student_org
      });
    }

    const payload = {
      sub: user.id,
      user: user.username,
    };

    const accessToken = await this.getAccessToken(payload);
    const refreshToken = await this.getRefreshToken(payload);

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: user,
    };
  }

  public async profile(sub: string): Promise<User> {
    return await this.userRepository.findOneOrFail({
      where: {
        id: sub,
      }
    });
  }

  private async getAccessToken(payload: TokenPayload): Promise<string> {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET,
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
    });

    return accessToken;
  }

  private async getRefreshToken(payload: TokenPayload): Promise<string> {
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    });

    return refreshToken;
  }
}
